import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Empty, List, message } from 'antd';
import { api } from '../api/client';

export function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (page = 1) => {
    const res = await api.get('/notifications', { params: { page, pageSize: 20 } });
    setItems(res.data.items);
    setTotal(res.data.total);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  const readAll = async () => {
    await api.post('/notifications/read-all');
    message.success('已全部标记为已读');
    load();
  };

  return (
    <Card title={`通知中心（${total}）`} extra={<Button onClick={readAll}>全部已读</Button>}>
      {items.length === 0 ? (
        <Empty description="暂无通知" />
      ) : (
        <List
          dataSource={items}
          renderItem={(item: any) => (
            <List.Item
              onClick={() => !item.readAt && markRead(item.id)}
              style={{ cursor: item.readAt ? 'default' : 'pointer' }}
            >
              <List.Item.Meta
                title={
                  <span>
                    {!item.readAt && <Badge status="processing" />} {item.title}
                  </span>
                }
                description={`${item.content} · ${item.createdAt.slice(0, 16).replace('T', ' ')}`}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}