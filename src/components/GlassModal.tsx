import React from 'react';

interface GlassModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title?: string;
}

const GlassModal: React.FC<GlassModalProps> = ({ isOpen, onClose, url, title }) => {
    if (!isOpen) return null;

    // Detect if running in Electron
    const isElectron = (window as any).require && (window as any).process && (window as any).process.type;

    return (
        <div style={styles.overlay}>
            <div style={styles.modalContainer}>
                {/* Header / Close Bar */}
                <div style={styles.header}>
                    <span style={styles.title}>{title || 'EdNovas'}</span>
                    <button onClick={onClose} style={styles.closeBtn}>
                        ✕
                    </button>
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
                            allowpopups={true as any}
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
        alignItems: 'center',
        animation: 'fadeIn 0.3s ease',
    },
    modalContainer: {
        width: '90%',
        height: '90%',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.18)',
    },
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
    closeBtn: {
        background: 'transparent',
        border: 'none',
        fontSize: '20px',
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
