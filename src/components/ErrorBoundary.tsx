import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : '未知错误';
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen theme-page flex items-center justify-center p-8">
          <div className="max-w-xl w-full theme-card rounded-lg border p-6">
            <h1 className="text-xl font-bold">页面加载失败</h1>
            <p className="mt-2 text-sm theme-text-secondary">这通常是数据格式异常或组件运行时错误导致的。</p>
            <div className="mt-4 text-xs bg-black/5 rounded p-3 whitespace-pre-wrap break-words">
              {this.state.message}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
              >
                刷新重试
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('trpg_last_campaign_id');
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                返回模组管理
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

