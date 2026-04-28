import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', background: '#fff0f0', color: '#ff0000', fontFamily: 'monospace', minHeight: '100vh' }}>
                    <h2>Algo correu mal no FitTraining! 💥</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', background: '#fff', border: '1px solid #fcc', padding: '1rem' }}>
                        <summary>Ver detalhes do erro</summary>
                        <strong>{this.state.error && this.state.error.toString()}</strong>
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '2rem', padding: '1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Recarregar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
