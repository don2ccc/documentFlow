import { Card, Empty, Typography } from "antd";
import { useLocation } from "react-router-dom";
import { HourglassOutlined } from "@ant-design/icons";

const TITLES: Record<string, string> = {
  "/admin/dormitory": "宿舍管理",
  "/admin/labor-protection": "劳保用品",
  "/production": "生产管理",
  "/hr": "HR管理"
};

export function ComingSoonPage() {
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "本功能";
  return (
    <Card>
      <div style={{ padding: "64px 0", textAlign: "center" }}>
        <HourglassOutlined style={{ fontSize: 96, color: "#faad14" }} />
        <Typography.Title level={3} style={{ marginTop: 24, marginBottom: 8 }}>{title}</Typography.Title>
        <Typography.Text type="secondary">正在开发中，敬请期待</Typography.Text>
      </div>
    </Card>
  );
}
