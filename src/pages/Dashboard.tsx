import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubscribe, downloadConfig } from '../services/api';
import { API_URL } from '../services/api';
import axios from 'axios';
import yaml from 'js-yaml'; // 🟢 引入 YAML 解析库

const electron = (window as any).require ? (window as any).require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

const CLASH_API_URL = 'http://127.0.0.1:9090';
const CLASH_WS_URL = 'ws://127.0.0.1:9090';

type ClashMode = 'Rule' | 'Global' | 'Direct';

interface UserData {
    transfer_enable: number;
    u: number;
    d: number;
    expired_at: number;
    plan_id?: any; // 🟢 新增 plan_id 用于判断是否订阅
}

interface ProxyGroup {
    name: string;
    type: string;
    now: string;
    all: string[];
}

const Dashboard = () => {
    const navigate = useNavigate();

    // 状态管理
    const [coreStatus, setCoreStatus] = useState<'stopped' | 'starting' | 'running'>('stopped');
    const [sysProxy, setSysProxy] = useState(false);
    const [tunMode, setTunMode] = useState(false);
    const [mode, setMode] = useState<ClashMode>('Rule');
    const [showLogWindow, setShowLogWindow] = useState(false); // 🟢 日志窗口开关

    const [userData, setUserData] = useState<UserData | null>(null);
    const [speed, setSpeed] = useState({ up: 0, down: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    // 🟢 订阅状态检查
    const [hasValidSubscription, setHasValidSubscription] = useState<boolean>(true); // 默认为 true，请求结果出来后再变



    const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
    // 🟢 存储从 YAML 解析出的原始顺序 (带持久化)
    const [groupOrder, setGroupOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('groupOrder');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // 开机自启状态
    const [autoStart, setAutoStart] = useState(false);

    const [delays, setDelays] = useState<{ [key: string]: number | string }>({});

    const testGroupLatency = async (groupName: string) => {
        const group = proxyGroups.find(g => g.name === groupName);
        if (!group) return;

        addLog(`⚡ 开始测速: ${groupName}`);
        const newDelays = { ...delays };

        // 🟢 并发测速
        const promises = group.all.map(async (nodeName) => {
            // 跳过 DIRECT, REJECT 等特殊节点
            if (nodeName === 'DIRECT' || nodeName === 'REJECT' || nodeName === 'GLOBAL') return;

            try {
                // 使用 Clash API 测速
                newDelays[nodeName] = '...'; // Loading state
                setDelays({ ...newDelays });

                const res = await axios.get(`${CLASH_API_URL}/proxies/${encodeURIComponent(nodeName)}/delay`, {
                    params: { timeout: 2000, url: 'http://www.gstatic.com/generate_204' }
                });
                newDelays[nodeName] = res.data.delay;
            } catch (e) {
                newDelays[nodeName] = -1; // Timeout/Error
            }
        });

        await Promise.all(promises);
        setDelays(prev => ({ ...prev, ...newDelays }));
        addLog(`✅ 测速完成: ${groupName}`);
    };

    // ... (existing code) ...

                                    <div style={isMain ? styles.mainGroupName : styles.groupName}>
                                        {group.name}
                                        {isMain && <span style={styles.mainTag}>核心</span>}
                                        <span 
                                            onClick={() => testGroupLatency(group.name)} 
                                            style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: '14px', opacity: 0.8 }} 
                                            title="一键测速"
                                        >
                                            ⚡
                                        </span>
                                    </div>
                                    <div style={styles.groupSelectWrapper}>
                                        <select
                                            value={group.now}
                                            onChange={(e) => changeGroupNode(group.name, e.target.value)}
                                            style={styles.groupSelect}
                                        >
                                            {group.all.map(node => {
                                                let delayText = '';
                                                const d = delays[node];
                                                if (d === '...') delayText = ' ⏳';
                                                else if (d === -1) delayText = ' ❌';
                                                else if (typeof d === 'number') delayText = ` ${d}ms`;
                                                
                                                return (
                                                    <option key={node} value={node}>
                                                        {node}{delayText}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                        <div style={isMain ? styles.mainSelectedNodeTag : styles.selectedNodeTag}>
                                            {group.now} 
                                            {delays[group.now] && typeof delays[group.now] === 'number' && <span style={{color: '#42e695', marginLeft: 8}}>{delays[group.now]}ms</span>}
                                            <span style={{ float: 'right', opacity: 0.5 }}>▼</span>
                                        </div>
                                    </div>

    const wsRef = useRef<WebSocket | null>(null);
    const hasAutoStarted = useRef(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        // 1. 获取用户信息 (还原流量显示)
        fetchUserInfo(token);

        // 2. 监听日志
        if (ipcRenderer) {
            ipcRenderer.on('clash-log', (_event: any, message: any) => {
                addLog(message.toString());
            });

            // 🟢 监听托盘系统代理开关
            ipcRenderer.on('tray-toggle-proxy', () => {
                toggleSystemProxy(); // Toggle based on current state
            });

            // 🟢 监听托盘模式切换
            ipcRenderer.on('tray-change-mode', (_event: any, newMode: ClashMode) => {
                changeMode(newMode);
            });
        }

        // 3. 自动启动
        if (!hasAutoStarted.current) {
            hasAutoStarted.current = true;
            // 只有当订阅有效时才启动内核，或者先尝试启动，如果失败可能是没订阅导致
            checkAndStartClash();
        }

        // 4. 获取开机自启状态
        if (ipcRenderer) {
            ipcRenderer.invoke('get-auto-start').then((enabled: boolean) => {
                setAutoStart(enabled);
            });
        }

        return () => {
            if (wsRef.current) wsRef.current.close();
            if (ipcRenderer) {
                ipcRenderer.removeAllListeners('clash-log');
                ipcRenderer.removeAllListeners('tray-toggle-proxy');
                ipcRenderer.removeAllListeners('tray-change-mode');
            }
        };
    }, []);

    // 🟢 轮询检测订阅状态 (当订阅无效时)
    useEffect(() => {
        let interval: any;
        if (!hasValidSubscription) {
            interval = setInterval(() => {
                const token = localStorage.getItem('token');
                if (token) fetchUserInfo(token);
            }, 3000); // 每3秒检查一次
        }
        return () => clearInterval(interval);
    }, [hasValidSubscription]);

    // 🟢 同步托盘状态
    useEffect(() => {
        if (ipcRenderer) {
            ipcRenderer.send('sync-tray-state', { sysProxy, mode });
        }
    }, [sysProxy, mode]);



    const toggleAutoStart = async () => {
        if (!ipcRenderer) return;
        const newState = !autoStart;
        await ipcRenderer.invoke('set-auto-start', newState);
        setAutoStart(newState);
        addLog(newState ? '✅ 已开启开机自启' : '🚫 已关闭开机自启');
    };

    const checkAndStartClash = async () => {
        try {
            await axios.get(`${CLASH_API_URL}/version`, { timeout: 1000 });
            setCoreStatus('running');
            addLog('✅ 内核已在运行');
            initClashConnection();
        } catch {
            startClashCore();
        }
    };

    const startClashCore = async () => {
        setCoreStatus('starting');
        let currentOrder: string[] = [];
        try {
            let configContent = '';
            const lastTime = parseInt(localStorage.getItem('lastSubscribeTime') || '0');
            const cachedConfig = localStorage.getItem('cachedClashConfig');
            const now = Date.now();
            const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

            // 🟢 检查缓存：如果有缓存且未过期（3天），则直接使用
            if (cachedConfig && (now - lastTime < THREE_DAYS)) {
                addLog('📂 使用本地缓存配置...');
                configContent = cachedConfig;
            } else {
                addLog('🚀 获取订阅...');
                const authToken = localStorage.getItem('token');
                const subRes = await getSubscribe(authToken!);
                const subData = subRes.data?.data || subRes.data;
                const subscribeToken = subData.token;

                const cleanApiUrl = API_URL.replace(/\/$/, '');
                const finalSubscribeUrl = `${cleanApiUrl}/2cvme3wa8i/${subscribeToken}&flag=clash`;

                addLog(`📥 下载配置...`);
                configContent = await downloadConfig(finalSubscribeUrl);

                // 🟢 更新缓存
                localStorage.setItem('cachedClashConfig', configContent);
                localStorage.setItem('lastSubscribeTime', now.toString());
            }

            // 🟢 解析 YAML 获取原始组顺序
            try {
                const parsedYaml = yaml.load(configContent) as any;
                if (parsedYaml && parsedYaml['proxy-groups']) {
                    const order = parsedYaml['proxy-groups'].map((g: any) => g.name);
                    setGroupOrder(order);
                    localStorage.setItem('groupOrder', JSON.stringify(order)); // 🟢持久化保存
                    currentOrder = order;
                    console.log('原始组顺序:', order);
                }
            } catch (err) {
                console.error('YAML解析失败', err);
            }

            // 配置文件修正
            let fixedConfig = configContent;
            if (fixedConfig.includes('external-controller')) {
                fixedConfig = fixedConfig.replace(/^external-controller:.*$/m, "external-controller: '127.0.0.1:9090'");
                fixedConfig = fixedConfig.replace(/^secret:.*$/m, "secret: ''");
            } else {
                fixedConfig = `external-controller: '127.0.0.1:9090'\nsecret: ''\n${fixedConfig}`;
            }

            // 强制 Rule 模式
            if (fixedConfig.includes('mode:')) {
                fixedConfig = fixedConfig.replace(/^mode:.*$/m, "mode: Rule");
            } else {
                fixedConfig = `mode: Rule\n${fixedConfig}`;
            }

            if (tunMode) {
                addLog('🛡️ 启用 TUN...');
                fixedConfig = `tun:\n  enable: true\n  stack: system\n  auto-route: true\n  auto-detect-interface: true\n  dns-hijack:\n    - any:53\n${fixedConfig}`;
            }

            if (ipcRenderer) {
                const res = await ipcRenderer.invoke('start-clash-service', fixedConfig);
                if (res.success) {
                    setCoreStatus('running');
                    addLog('✅ 内核启动成功');
                    setTimeout(() => {
                        // toggleSystemProxy(true); // 🟢 用户要求不再自动开启系统代理
                        initClashConnection(currentOrder);
                    }, 1000);
                }
            }
        } catch (e: any) {
            setCoreStatus('stopped');
            addLog(`❌ 启动失败: ${e.message}`);
        }
    };

    const initClashConnection = async (order?: string[]) => {
        // 🟢 循环检查 API 是否就绪 (防止 MMDB 下载导致 API 延迟启动)
        let retries = 0;
        const maxRetries = 120; // 120秒超时 (考虑到国内网络下载 MMDB 可能较慢)

        while (retries < maxRetries) {
            try {
                await axios.get(`${CLASH_API_URL}/version`, { timeout: 1000 });
                break; // API 就绪
            } catch (e) {
                retries++;
                // 每2秒提示一次
                if (retries % 2 === 0) {
                    addLog(`⏳ 等待内核初始化... (${retries}s)`);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (retries >= maxRetries) {
            addLog(`❌ 内核响应超时，请重试`);
            return;
        }

        if (!wsRef.current) {
            const ws = new WebSocket(`${CLASH_WS_URL}/traffic?token=`);
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setSpeed({ up: data.up, down: data.down });
            };
            wsRef.current = ws;
        }
        // 强制切到 Rule
        try { await axios.patch(`${CLASH_API_URL}/configs`, { mode: 'Rule' }); setMode('Rule'); } catch { }
        fetchProxyGroups(order);
    };

    const fetchProxyGroups = async (overrideOrder?: string[]) => {
        try {
            const res = await axios.get(`${CLASH_API_URL}/proxies`);
            const proxies = res.data.proxies;
            const groups: ProxyGroup[] = [];

            Object.keys(proxies).forEach(key => {
                const item = proxies[key];
                // 过滤掉非 Selector 类型，保留 GLOBAL 以备不时之需，但通常隐藏
                if (item.type === 'Selector') {
                    groups.push({ name: key, type: item.type, now: item.now, all: item.all });
                }
            });

            // 🟢 核心：使用解析出的 groupOrder 进行排序
            const effectiveOrder = (overrideOrder && overrideOrder.length > 0) ? overrideOrder : groupOrder;
            if (effectiveOrder.length > 0) {
                groups.sort((a, b) => {
                    const idxA = effectiveOrder.indexOf(a.name);
                    const idxB = effectiveOrder.indexOf(b.name);
                    // 如果都在顺序列表中，按列表排序
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    // 如果只有A在列表，A在前
                    if (idxA !== -1) return -1;
                    // 如果只有B在列表，B在前
                    if (idxB !== -1) return 1;
                    // 都不在列表，保持原样
                    return 0;
                });
            }

            setProxyGroups(groups);
        } catch (e) { console.error(e); }
    };

    const changeGroupNode = async (groupName: string, nodeName: string) => {
        try {
            await axios.put(`${CLASH_API_URL}/proxies/${encodeURIComponent(groupName)}`, { name: nodeName });
            setProxyGroups(prev => prev.map(g => g.name === groupName ? { ...g, now: nodeName } : g));
        } catch (e) { addLog(`❌ 切换失败`); }
    };

    const toggleSystemProxy = async (forceState?: boolean) => {
        if (!ipcRenderer) return;
        const newState = forceState !== undefined ? forceState : !sysProxy;
        const res = await ipcRenderer.invoke('set-system-proxy', newState);
        if (res.success) setSysProxy(newState);
    };

    const changeMode = async (newMode: ClashMode) => {
        try {
            await axios.patch(`${CLASH_API_URL}/configs`, { mode: newMode });
            setMode(newMode);
        } catch (e) { }
    };

    // 🟢 自动恢复 TUN 模式 (重启后)
    useEffect(() => {
        const checkPendingTun = async () => {
            const pending = localStorage.getItem('pendingTunMode');
            if (pending === 'true' && ipcRenderer) {
                const isAdmin = await ipcRenderer.invoke('check-is-admin');
                if (isAdmin) {
                    addLog('🛡️ 检测到重启，自动开启 TUN 模式...');
                    setTunMode(true);
                    setTimeout(startClashCore, 1000); // 稍等片刻启动
                }
                localStorage.removeItem('pendingTunMode');
            }
        };
        checkPendingTun();
    }, []);

    // ... (existing code) ...

    const toggleTunMode = async () => {
        // 🟢 检查管理员权限 (仅当尝试开启 TUN 时)
        if (!tunMode && ipcRenderer) {
            const isAdmin = await ipcRenderer.invoke('check-is-admin');
            if (!isAdmin) {
                if (confirm('启用 TUN 模式需要管理员权限。\n\n是否立即以管理员身份重启软件？')) {
                    localStorage.setItem('pendingTunMode', 'true'); // 🟢 标记重启意图
                    await ipcRenderer.invoke('relaunch-as-admin');
                }
                return; // 无论是否确认重启，都先中断当前操作
            }
        }

        if (coreStatus === 'running' && !confirm('切换 TUN 需要重启内核，继续？')) return;
        setTunMode(!tunMode);
        if (coreStatus === 'running') setTimeout(startClashCore, 500);
    };

    // 辅助函数
    const fetchUserInfo = async (token: string) => {
        try {
            const res = await getSubscribe(token);
            const data = res.data?.data || res.data;
            if (data) {
                setUserData({ ...data, u: data.u || 0, d: data.d || 0, expired_at: data.expired_at || 0 });
                // 🟢 检查是否有效订阅 (如果有 plan_id 说明有订阅)
                if (data.plan_id) {
                    setHasValidSubscription(true);
                } else {
                    setHasValidSubscription(false);
                }
            }
        } catch (e) { console.error(e); }
    };

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // 🟢 判断是否为主要规则集 (用于放大显示)
    const isMainGroup = (name: string) => {
        if (mode === 'Global') {
            return name === 'GLOBAL' || name === 'Global';
        }
        return name.includes('EdNovas') || name === 'Proxy' || name === '节点选择';
    };

    // 🟢 动态排序逻辑
    const displayedGroups = useMemo(() => {
        const sorted = [...proxyGroups];
        if (mode === 'Global') {
            // Global 模式下，把 GLOBAL 放到第一位
            const globalIndex = sorted.findIndex(g => g.name === 'GLOBAL' || g.name === 'Global');
            if (globalIndex !== -1) {
                const globalGroup = sorted.splice(globalIndex, 1)[0];
                sorted.unshift(globalGroup);
            }
        }
        // Rule 模式下保持默认顺序 (fetchProxyGroups 已处理)
        return sorted;
    }, [proxyGroups, mode]);

    return (
        <div style={styles.container}>


            {/* 顶部栏 */}
            <div style={styles.header}>
                {/* 用户信息区 (流量+到期) */}
                <div style={styles.userInfo}>
                    {/* 🟢 开机自启开关 (移入文档流，避免被标题栏遮挡) */}


                    <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '800', background: 'linear-gradient(45deg, #7aa2f7, #b4f9f8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EdNovas云</h2>
                    {userData ? (
                        <div style={styles.trafficInfo}>
                            <div style={styles.trafficText}>
                                <span>已用: {formatBytes(userData.u + userData.d)}</span>
                                <span style={{ margin: '0 5px', color: '#666' }}>/</span>
                                <span>总计: {formatBytes(userData.transfer_enable)}</span>
                            </div>
                            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
                                {userData.expired_at === 0 ? '长期有效' : `到期: ${new Date(userData.expired_at * 1000).toLocaleDateString()}`}
                                <span onClick={() => {
                                    const url = `${API_URL}/#/stage/buysubs`;
                                    if (ipcRenderer) ipcRenderer.send('open-external', url);
                                    else window.open(url, '_blank');
                                }} style={{ marginLeft: '10px', background: 'linear-gradient(90deg, #42e695, #3bb2b8)', color: '#1e1e1e', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(66, 230, 149, 0.3)', display: 'inline-block', WebkitAppRegion: 'no-drag' } as any}>
                                    ⚡ 立即续费
                                </span>
                            </div>


                        </div>
                    ) : (
                        <div style={{ fontSize: '12px' }}>正在获取账户信息...</div>
                    )}
                    <div style={styles.speedBox}>
                        <div style={{ color: '#42e695' }}>⬇ {formatBytes(speed.down)}/s</div>
                        <div style={{ color: '#7aa2f7' }}>⬆ {formatBytes(speed.up)}/s</div>
                    </div>
                </div>

                {/* 右侧控制区 */}
                <div style={styles.controls}>
                    <div style={styles.buttonGroup}>
                        <div onClick={toggleTunMode} style={{ ...styles.tagBtn, background: tunMode ? '#e6a23c' : '#333', WebkitAppRegion: 'no-drag' } as any}>
                            TUN 模式
                        </div>

                        <div onClick={() => toggleSystemProxy()} style={{ ...styles.proxyBtn, background: sysProxy ? '#ff4d4f' : '#42e695', WebkitAppRegion: 'no-drag' } as any}>
                            {sysProxy ? '断开连接' : '一键连接'}
                        </div>

                        <div onClick={() => setShowLogWindow(true)} style={{ ...styles.iconBtn, WebkitAppRegion: 'no-drag' } as any} title="查看日志">
                            📃
                        </div>
                    </div>
                </div>
            </div>

            {/* 模式切换栏 */}
            <div style={styles.modeBar}>
                {(['Rule', 'Global', 'Direct'] as ClashMode[]).map(m => (
                    <div
                        key={m} onClick={() => changeMode(m)}
                        style={{ ...styles.modeBtn, background: mode === m ? '#7aa2f7' : 'transparent', color: mode === m ? '#fff' : '#aaa' }}
                    >
                        {m === 'Rule' ? '规则模式' : m === 'Global' ? '全局模式' : '直连模式'}
                    </div>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <label className="toggle-switch" style={{ width: '30px', height: '16px', marginRight: '6px' }}>
                            <input type="checkbox" checked={autoStart} onChange={toggleAutoStart} />
                            <span className="slider"></span>
                        </label>
                        <span style={{ fontSize: '12px', color: '#aaa', fontWeight: 'bold' }}>自启</span>
                    </div>
                    <div onClick={() => { localStorage.removeItem('token'); navigate('/'); }} style={styles.logoutText}>退出登录</div>
                </div>
            </div>

            {/* 策略组列表 */}
            <div style={styles.groupContainer}>
                {coreStatus === 'running' ? (
                    displayedGroups.length > 0 ? (
                        displayedGroups.map(group => {
                            const isMain = isMainGroup(group.name);
                            return (
                                <div key={group.name} style={isMain ? styles.mainGroupCard : styles.groupCard}>
                                    <div style={isMain ? styles.mainGroupName : styles.groupName}>
                                        {group.name}
                                        {isMain && <span style={styles.mainTag}>核心</span>}
                                    </div>
                                    <div style={styles.groupSelectWrapper}>
                                        <select
                                            value={group.now}
                                            onChange={(e) => changeGroupNode(group.name, e.target.value)}
                                            style={styles.groupSelect}
                                        >
                                            {group.all.map(node => (
                                                <option key={node} value={node}>{node}</option>
                                            ))}
                                        </select>
                                        <div style={isMain ? styles.mainSelectedNodeTag : styles.selectedNodeTag}>
                                            {group.now} <span style={{ float: 'right', opacity: 0.5 }}>▼</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>正在加载规则组...</div>
                    )
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>正在启动内核服务...</div>
                )}
            </div>


            {/* 🟢 悬浮日志窗口 (可隐藏) */}
            {
                showLogWindow && (
                    <div style={styles.logOverlay}>
                        <div style={styles.logHeader}>
                            <span>运行日志</span>
                            <span onClick={() => setShowLogWindow(false)} style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '18px', lineHeight: '1' }}>✖</span>
                        </div>
                        <div style={styles.logContent}>
                            {logs.map((log, i) => <div key={i} style={{ marginBottom: 4, borderBottom: '1px solid #333' }}>{log}</div>)}
                        </div>
                    </div>
                )
            }

            {/* 🟢 无有效订阅时的覆盖层 */}
            {
                !hasValidSubscription && (
                    <div style={styles.subscriptionOverlay}>
                        <div style={styles.subscriptionCard}>
                            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚫</div>
                            <h2 style={{ marginBottom: '15px', color: '#ff4d4f' }}>未检测到有效订阅</h2>
                            <p style={{ marginBottom: '25px', color: '#ccc', lineHeight: '1.6' }}>
                                您的账户当前没有任何有效的订阅计划。<br />
                                请前往网页端购买订阅以继续使用。
                            </p>
                            <button
                                onClick={() => {
                                    const url = `${API_URL}/#/stage/buysubs`;
                                    if (ipcRenderer) ipcRenderer.send('open-external', url);
                                    else window.open(url, '_blank');
                                }}
                                style={styles.buyButton}
                            >
                                前往购买订阅
                            </button>
                            <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                                正在检测订阅状态... <span className="loading-dots"></span>
                            </div>
                            <div
                                onClick={() => { localStorage.removeItem('token'); navigate('/'); }}
                                style={{ marginTop: '15px', color: '#aaa', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}
                            >
                                退出登录
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};


const styles: { [key: string]: React.CSSProperties } = {
    container: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #1a1b1e 0%, #141414 100%)', color: '#fff', fontFamily: '"Segoe UI", Roboto, sans-serif' },
    header: { padding: '50px 25px 20px 25px', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', WebkitAppRegion: 'drag' } as any,
    userInfo: { display: 'flex', flexDirection: 'column' },
    trafficInfo: { fontSize: '13px', color: '#ccc' },
    trafficText: { marginBottom: '4px', fontWeight: 'bold' },

    controls: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', marginTop: '35px' },
    speedBox: { fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', display: 'flex', gap: '15px', marginTop: '8px' },
    buttonGroup: { display: 'flex', gap: '10px', alignItems: 'center' },

    tagBtn: { padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    proxyBtn: { padding: '10px 32px', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', minWidth: '120px', textAlign: 'center', transition: 'all 0.3s transform', letterSpacing: '1px' },
    iconBtn: { cursor: 'pointer', fontSize: '18px', padding: '5px' },

    modeBar: { display: 'flex', padding: '10px 20px', background: '#2d2d2d', gap: '10px', alignItems: 'center' },
    modeBtn: { padding: '5px 15px', borderRadius: '15px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600 },
    logoutText: { fontSize: '12px', color: '#fff', background: '#ff4d4f', padding: '5px 15px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(255, 77, 79, 0.3)', transition: 'all 0.2s' },

    groupContainer: { flex: 1, overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px', alignContent: 'start' },

    // 普通卡片样式
    groupCard: { background: '#252526', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #3e3e3e' },
    groupName: { fontSize: '14px', fontWeight: 'bold', color: '#ddd' },
    selectedNodeTag: { background: '#333', color: '#ccc', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid #444' },

    // 🟢 主要卡片样式 (放大/高亮)
    mainGroupCard: { background: 'linear-gradient(145deg, #2b3040, #252526)', borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px', border: '2px solid #7aa2f7', gridColumn: 'span 2' }, // 占据两列
    mainGroupName: { fontSize: '18px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' },
    mainTag: { fontSize: '10px', background: '#ff4d4f', padding: '2px 6px', borderRadius: '4px' },
    mainSelectedNodeTag: { background: '#7aa2f7', color: '#1e1e1e', padding: '10px 15px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', textAlign: 'left', cursor: 'pointer', boxShadow: '0 4px 10px rgba(122, 162, 247, 0.2)' },

    groupSelectWrapper: { position: 'relative' },
    groupSelect: { width: '100%', height: '100%', opacity: 0, position: 'absolute', top: 0, left: 0, cursor: 'pointer' },

    // 日志窗口
    logOverlay: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: '900px', height: '700px', maxHeight: '90vh', background: '#1e1e1e', border: '1px solid #444', borderRadius: '8px', boxShadow: '0 0 50px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', zIndex: 10000, WebkitAppRegion: 'no-drag' } as any,
    logHeader: { padding: '15px', background: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' },
    logContent: { flex: 1, overflowY: 'auto', padding: '10px', fontFamily: 'monospace', fontSize: '12px', color: '#ccc' },

    // 🟢 订阅覆盖层样式
    subscriptionOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 20000, display: 'flex', justifyContent: 'center', alignItems: 'center', WebkitAppRegion: 'drag' } as any,
    subscriptionCard: { background: '#1e1e1e', padding: '40px', borderRadius: '15px', textAlign: 'center', width: '400px', border: '1px solid #333', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', WebkitAppRegion: 'no-drag' } as any,
    buyButton: { background: 'linear-gradient(90deg, #42e695, #3bb2b8)', border: 'none', padding: '12px 30px', borderRadius: '25px', fontSize: '16px', fontWeight: 'bold', color: '#1e1e1e', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(66, 230, 149, 0.3)' },


};

export default Dashboard;