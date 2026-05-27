import React, { useCallback, useEffect, useState } from 'react';
import App from './App';
import MigrationStatusScreen from './components/system/MigrationStatusScreen';
import StartupSplashScreen from './components/system/StartupSplashScreen';
import { migrationService, type MigrationStatus } from './services/migrationService';

type BootstrapState =
  | { phase: 'checking'; status: MigrationStatus | null; error: string | null }
  | { phase: 'blocked'; status: MigrationStatus | null; error: string | null }
  | { phase: 'ready'; status: MigrationStatus; error: null };

const BootstrapApp: React.FC = () => {
  const [state, setState] = useState<BootstrapState>({
    phase: 'checking',
    status: null,
    error: null,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);

  const runBootstrap = useCallback(async () => {
    setState((prev) => ({
      phase: 'checking',
      status: prev.status,
      error: null,
    }));
    setActionMessage(null);

    try {
      const status = await migrationService.getStatus();
      if (!status.canEnterApp) {
        setState({
          phase: 'blocked',
          status,
          error: null,
        });
        return;
      }

      setState({
        phase: 'ready',
        status,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        phase: 'blocked',
        status: prev.status,
        error: error instanceof Error ? error.message : '启动检查失败，请稍后重试。',
      }));
    }
  }, []);

  const handleStartMigration = useCallback(async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const result = await migrationService.startMigration();
      setBackupPath(result.backupPath ?? null);
      setActionMessage(result.message);
      if (result.status.canEnterApp) {
        await runBootstrap();
      } else {
        setState({
          phase: 'blocked',
          status: result.status,
          error: null,
        });
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '数据库迁移执行失败，请稍后重试。');
    } finally {
      setActionLoading(false);
    }
  }, [runBootstrap]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  if (state.phase === 'checking') {
    return <StartupSplashScreen message="正在检查数据库状态..." />;
  }

  if (state.phase === 'ready') {
    return <App />;
  }

  return (
    <MigrationStatusScreen
      status={state.status}
      loading={false}
      error={state.error}
      actionLoading={actionLoading}
      actionMessage={actionMessage}
      backupPath={backupPath}
      onRetry={() => {
        void runBootstrap();
      }}
      onStartMigration={() => {
        void handleStartMigration();
      }}
    />
  );
};

export default BootstrapApp;
