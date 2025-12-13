import React from 'react';

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title?: string;
}

const GlassModal: React.FC<GlassModalProps> = ({ isOpen, onClose, url, title }) => {
    // Toggle Crisp chat visibility
    React.useEffect(() => {
        const crisp = (window as any).$crisp;
        if (crisp) {
            if (isOpen) {
                crisp.push(['do', 'chat:hide']);
            } else {
                crisp.push(['do', 'chat:show']);
            }
        }
        return () => {
            if (crisp) crisp.push(['do', 'chat:show']);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Detect if running in Electron
    const isElectron = (window as any).require && (window as any).process && (window as any).process.type;

    const handleOpenExternally = () => {
        const electron = (window as any).require ? (window as any).require('electron') : null;
        if (electron) {
            electron.shell.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modalContainer}>
                {/* Header / Close Bar */}
                <div style={styles.header}>
                    <span style={styles.title}>{title || 'EdNovas'}</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleOpenExternally} style={styles.iconBtn} title="在浏览器打开">
                            🌐
                        </button>
                        <button onClick={onClose} style={styles.iconBtn}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {/* 
                        Use <webview> in Electron for better compatibility with external sites (headers, auth, etc.)
                        Fallback to <iframe> for browser development 
                    */}
                    {isElectron ? (
                        // @ts-ignore - webview is an Electron specific tag
                        <webview
                            src={url}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allowpopups={true as any} // 🟢 Fix type error
                        />
                    ) : (
                        <iframe
                            src={url}
                            style={styles.iframe}
                            title="Internal Browser"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly dark overlay
        backdropFilter: 'blur(15px)', // Frosted glass effect
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start', // 🟢 Changed to flex-start for top padding
        paddingTop: '50px', // 🟢 Less padding
        animation: 'fadeIn 0.3s ease',
        pointerEvents: 'auto', // 🟢 Allow clicks
    },
    modalContainer: {
        width: '90%', // 🟢 Wider
        height: '92%', // 🟢 Taller
        maxHeight: 'calc(100vh - 60px)', // 🟢 Maximize space
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        WebkitAppRegion: 'no-drag', // 🟢 Only disable drag on modal itself
    } as any,
    header: {
        height: '50px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid rgba(0,0,0,0.1)',
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(5px)',
    },
    title: {
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#333',
    },
    iconBtn: {
        background: 'transparent',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        color: '#666',
        padding: '5px',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
    },
    content: {
        flex: 1,
        width: '100%',
        height: '100%',
        background: '#fff',
        position: 'relative',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
    },
};

export default GlassModal;
