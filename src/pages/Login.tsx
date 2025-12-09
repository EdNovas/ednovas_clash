import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, API_URL, initApi } from '../services/api';

// 兼容 Electron 引入
const electron = (window as any).require ? (window as any).require('electron') : null;
const shell = electron ? electron.shell : null;

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 🔵 新增：用于控制页面是否正在检查登录状态
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        // 🔵 核心逻辑：自动检测登录状态
        const checkAuth = () => {
            const token = localStorage.getItem('token');
            if (token) {
                // 如果有 token，直接跳转到仪表盘
                navigate('/dashboard', { replace: true });
            } else {
                // 如果没有，显示登录表单
                setIsCheckingAuth(false);
            }
        };

        checkAuth();

        // 🟢 自动寻找最快节点
        initApi();

        // 注入 Crisp (客服)
        (window as any).$crisp = [];
        (window as any).CRISP_WEBSITE_ID = "6062421b-50f5-4dc7-a610-1722a9efc3c4";
        (function () {
            const d = document;
            const s = d.createElement("script");
            s.src = "https://client.crisp.chat/l.js";
            s.async = true;
            d.getElementsByTagName("head")[0].appendChild(s);
        })();

        // 注入 Clarity (统计)
        (function (c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "lg9eq53kin");
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await login(email, password);
            // 优先获取 auth_data
            const token = res.data?.auth_data || res.data?.token;

            if (token) {
                localStorage.setItem('token', token);
                navigate('/dashboard');
            } else {
                setError('登录成功，但未获取到鉴权信息');
            }
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || err.message || '登录失败，请检查网络';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = () => {
        if (shell) {
            shell.openExternal(`${API_URL}/#/register`);
        } else {
            window.open(`${API_URL}/#/register`, '_blank');
        }
    };

    // 🔵 如果正在检查登录状态，显示空白或加载动画，防止闪烁
    if (isCheckingAuth) {
        return (
            <div style={styles.container}>
                <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                    正在验证身份...
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.glassCard}>
                <div style={styles.header}>
                    <div style={styles.logoIcon}>✈️</div>
                    <h2 style={styles.title}>EdNovas云</h2>
                    <p
                        style={{
                            ...styles.subtitle,
                            marginTop: '15px',
                            cursor: 'pointer',
                            color: '#667eea',
                            background: 'rgba(102, 126, 234, 0.1)',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            transition: 'all 0.2s'
                        }}
                        onClick={() => {
                            const url = 'https://help.ednovas.me';
                            if (shell) shell.openExternal(url);
                            else window.open(url, '_blank');
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)'}
                    >
                        用户说明
                    </p>
                </div>

                <form onSubmit={handleLogin} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <input
                            type="email"
                            placeholder="电子邮箱"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <input
                            type="password"
                            placeholder="密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            required
                        />
                    </div>

                    {error && <div style={styles.errorMsg}>{error}</div>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                        <span onClick={() => {
                            const url = `${API_URL}/#/reset-password`;
                            if (shell) shell.openExternal(url);
                            else window.open(url, '_blank');
                        }} style={{ fontSize: '12px', color: '#667eea', cursor: 'pointer', textDecoration: 'none' }}>
                            忘记密码？
                        </span>
                    </div>

                    <button
                        type="submit"
                        style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
                        disabled={loading}
                    >
                        {loading ? '正在登录...' : '立即登录'}
                    </button>

                    <div style={styles.divider}>
                        <span>或者</span>
                    </div>

                    <button
                        type="button"
                        onClick={handleRegister}
                        style={styles.registerButton}
                    >
                        注册新账户
                    </button>
                </form>
            </div>

            <div style={styles.footer}>
                Powered by EdNovas
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        height: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        WebkitAppRegion: 'drag', // 🟢 允许拖拽整个窗口背景
    } as any,
    glassCard: {
        width: '380px',
        padding: '40px 30px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 1,
        WebkitAppRegion: 'no-drag', // 🟢 禁止拖拽卡片区域，以允许文字选择和输入
    } as any,
    header: { textAlign: 'center', marginBottom: '30px' },
    logoIcon: { fontSize: '48px', marginBottom: '10px' },
    title: { margin: '0', color: '#333', fontSize: '28px', fontWeight: '700' },
    subtitle: { margin: '5px 0 0 0', color: '#666', fontSize: '14px' },
    form: { width: '100%' },
    inputGroup: { marginBottom: '20px' },
    input: {
        width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #eee',
        backgroundColor: '#f9f9f9', fontSize: '16px', outline: 'none',
        boxSizing: 'border-box'
    },
    errorMsg: {
        color: '#ff4d4f', fontSize: '14px', marginBottom: '15px', textAlign: 'center',
        backgroundColor: '#fff1f0', padding: '8px', borderRadius: '8px', border: '1px solid #ffccc7'
    },
    button: {
        width: '100%', padding: '15px', borderRadius: '12px', border: 'none',
        background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white',
        fontSize: '16px', fontWeight: '600', cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(118, 75, 162, 0.3)',
    },
    buttonDisabled: { opacity: 0.7, cursor: 'not-allowed' },
    divider: { margin: '20px 0', textAlign: 'center', color: '#999', fontSize: '12px' },
    registerButton: {
        width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #667eea',
        background: 'transparent', color: '#667eea', fontSize: '15px', fontWeight: '600', cursor: 'pointer',
    },
    footer: { position: 'absolute', bottom: '20px', color: 'rgba(255,255,255,0.6)', fontSize: '12px' },
};

export default Login;