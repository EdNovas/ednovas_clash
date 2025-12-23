// src/services/api.ts
import axios from 'axios';

// ⚠️ Dynamic API Selection
export let API_URL = 'https://new.ednovas.dev'; // Default start

// 备用地址列表 (可以从外部 JSON 获取)
// 模拟从 GitHub 或其他地方获取的列表
const FETCH_REMOTE_CONFIG_URLS = [
    'https://raw.githubusercontent.com/EdNovas/config/refs/heads/main/domains.json', // 示例: GitHub Raw
    'https://aaa.ednovas.xyz/domains.json'
];

// 硬编码备用列表 (防止远程获取失败)
const DEFAULT_BACKUPS = [
    'https://new.ednovas.org',
    'https://cdn.ednovas.world',
];

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
});

// 🟢 手动切换 API 节点 (用于失败重试)
// 🟢 手动切换 API 节点 (用于失败重试)
export const updateApiUrl = (newUrl: string) => {
    console.log(`[API] Switching to ${newUrl}`);
    emitStatus(`已手动切换至: ${newUrl}`);
    API_URL = newUrl;
    api.defaults.baseURL = newUrl;
};

let initPromise: Promise<string> | null = null;

// Event Listener for Polling Status
type PollingStatusCallback = (status: string) => void;
let statusListeners: PollingStatusCallback[] = [];

export const onPollingStatus = (callback: PollingStatusCallback) => {
    statusListeners.push(callback);
    return () => {
        statusListeners = statusListeners.filter(l => l !== callback);
    };
};

const emitStatus = (status: string) => {
    statusListeners.forEach(l => l(status));
};

// 检查单个 URL 是否可用
const checkUrl = async (url: string): Promise<string> => {
    try {
        emitStatus(`正在检测: ${url}`);
        // 尝试 HEAD 请求或简单的 GET
        // 这里的 timeout 设置短一点，快速筛选
        await axios.get(`${url}/api/v1/guest/comm/config`, { timeout: 3000 });
        return url;
    } catch (e) {
        throw e;
    }
};

// 获取最快的可用 URL
export let apiCandidates: string[] = []; // 🟢 导出候选列表给外部重试用

export const initApi = async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        emitStatus('正在获取云端节点列表...');
        console.log('正在寻找最佳服务器...');

        // 1. 尝试获取远程配置列表
        let remoteDomains: string[] = [];
        for (const configUrl of FETCH_REMOTE_CONFIG_URLS) {
            try {
                const res = await axios.get(configUrl, { timeout: 3000 });
                if (Array.isArray(res.data)) remoteDomains = res.data;
                break;
            } catch (e) { console.warn('获取远程域名列表失败', e); }
        }


        const candidates = [...new Set([...remoteDomains, ...DEFAULT_BACKUPS])];
        apiCandidates = candidates; // 🟢 保存到导出变量

        // 2. 并发测试所有 URL
        try {
            emitStatus(`正在并发测试 ${candidates.length} 个节点...`);
            const fastestUrl = await Promise.any(candidates.map(url => checkUrl(url)));
            emitStatus(`✅ 已连接: ${fastestUrl}`);
            console.log(`✅ 选定最佳节点: ${fastestUrl}`);
            API_URL = fastestUrl;
            api.defaults.baseURL = fastestUrl; // 更新 axios 实例
            return fastestUrl;
        } catch (error) {
            emitStatus('❌ 所有节点连接失败，使用默认');
            console.error('❌ 所有节点均不可用', error);
            // 虽然都失败了，还是保留默认
            return API_URL;
        }
    })();

    return initPromise;
};

// 登录接口
export const login = async (email: string, password: string) => {
    await initApi(); // 确保 API 已初始化
    const response = await api.post('/api/v1/passport/auth/login', {
        email,
        password,
    });
    return response.data;
};

// 获取用户信息
export const getUserInfo = async (token: string) => {
    await initApi();
    // 这里的 token 必须是登录返回的 auth_data
    return api.get('/api/v1/user/info', {
        headers: {
            // V2Board 中间件直接读取 header，不能加 'Bearer ' 前缀
            'Authorization': token
        },
        // 双重保险：有些服务器配置可能会过滤 Header，我们同时也放到参数里
        params: {
            auth_data: token
        }
    });
};

// 获取订阅信息 (用于获取流量和节点链接)
export const getSubscribe = async (token: string) => {
    await initApi();
    return api.get('/api/v1/user/getSubscribe', {
        headers: {
            'Authorization': token
        },
        params: {
            auth_data: token
        }
    });
};

// 下载实际的 YAML 配置文件
export const downloadConfig = async (subscribeUrl: string) => {
    // 确保下载链接包含 flag=clash
    if (subscribeUrl.indexOf('flag=clash') === -1 && subscribeUrl.indexOf('clash') === -1) {
        subscribeUrl += (subscribeUrl.includes('?') ? '&' : '?') + 'flag=clash';
    }

    const response = await axios.get(subscribeUrl, {
        responseType: 'text',
        headers: { 'User-Agent': 'ClashforWindows/0.19.0' }
    });
    return response.data;
};