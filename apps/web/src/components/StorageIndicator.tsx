import { useEffect, useState } from "react";
import { Spin, Tooltip } from "antd";

const STORAGE_CSS = `
.app-storage-card {
  margin: 14px 12px 16px;
  padding: 12px 14px;
  background: #202b3d;
  border: 1px solid #526174;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
}
.app-storage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: #c8d1df;
}
.app-storage-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.app-storage-label .anticon {
  color: #f36b21;
}
.app-storage-pct {
  color: #f36b21;
  font-weight: 600;
  font-size: 13px;
}
.app-storage-bar {
  height: 6px;
  width: 100%;
  background: #596579;
  border-radius: 999px;
  overflow: hidden;
}
.app-storage-bar-fill {
  height: 100%;
  background: #f36b21;
  border-radius: 999px;
  transition: width 0.4s ease;
}
.app-storage-foot {
  margin-top: 8px;
  font-size: 12px;
  color: #b3bfd0;
  line-height: 1.5;
}
.app-storage-used {
  color: #ffffff;
  font-weight: 500;
}
.app-storage-total {
  color: #9ba7b8;
}
`;
import { CloudServerOutlined } from "@ant-design/icons";
import { systemMonitorApi, StorageInfo } from "../api/endpoints";

function formatGB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageIndicator() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const REFRESH_MS = 30_000;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await systemMonitorApi.storage();
        if (!cancelled) {
          setInfo(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message ?? "无法读取");
      }
    };
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);


  return (
    <>
      <style>{STORAGE_CSS}</style>
    <div className="app-storage-card">
      <div className="app-storage-header">
        <span className="app-storage-label">
          <CloudServerOutlined />
          <span>服务器存储</span>
        </span>
        {info && <span className="app-storage-pct">{info.usagePercent}%</span>}
      </div>
      {!info && !error && (
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Spin size="small" /> 加载中…
        </div>
      )}
      {error && (
        <Tooltip title={error}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>存储:读取失败</div>
        </Tooltip>
      )}
      {info && (
        <Tooltip title={`已用 ${formatGB(info.usedBytes)} / 共 ${formatGB(info.totalBytes)} (${info.usagePercent}%)`}>
          <div>
            <div className="app-storage-bar">
              <div className="app-storage-bar-fill" style={{ width: `${Math.min(100, info.usagePercent)}%` }} />
            </div>
            <div className="app-storage-foot">
              已使用 <span className="app-storage-used">{formatGB(info.usedBytes)}</span>
              <span className="app-storage-total"> / {formatGB(info.totalBytes)}</span>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
    </>
  );
}
