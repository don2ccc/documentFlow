import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Space, Switch, message } from 'antd';
import { MailOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { settingsApi, SystemSettingItem } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';

const SMTP_KEYS = ['smtp.host', 'smtp.port', 'smtp.secure', 'smtp.user', 'smtp.pass', 'smtp.from'] as const;

export function SystemSettingsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SystemSettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.list();
      setItems(data);
      const initial: Record<string, string> = {};
      for (const key of SMTP_KEYS) {
        const row = data.find((r) => r.key === key);
        initial[key] = row?.value ?? '';
      }
      form.setFieldsValue({
        'smtp.host': initial['smtp.host'],
        'smtp.port': Number(initial['smtp.port'] || 465),
        'smtp.secure': (initial['smtp.secure'] || 'true').toLowerCase() !== 'false',
        'smtp.user': initial['smtp.user'],
        'smtp.pass': initial['smtp.pass'],
        'smtp.from': initial['smtp.from'] || (initial['smtp.user'] || 'no-reply@example.com')
      });
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = useCallback(async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await Promise.all([
        settingsApi.set('smtp.host', String(v['smtp.host'] ?? '')),
        settingsApi.set('smtp.port', String(v['smtp.port'] ?? 465)),
        settingsApi.set('smtp.secure', String(!!v['smtp.secure'])),
        settingsApi.set('smtp.user', String(v['smtp.user'] ?? '')),
        settingsApi.set('smtp.pass', String(v['smtp.pass'] ?? '')),
        settingsApi.set('smtp.from', String(v['smtp.from'] ?? ''))
      ]);
      message.success('已保存，下次发件立即生效');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const onTestSend = useCallback(async () => {
    const fromField = form.getFieldValue('smtp.from');
    const fallback = (typeof fromField === 'string' ? fromField.match(/<([^>]+)>/)?.[1] : null) || 'test@example.com';
    const target = window.prompt('把测试邮件发到哪个邮箱？', fallback);
    if (!target) return;
    try {
      const r = await settingsApi.testEmail(target);
      if (r.ok) message.success(`测试邮件已发到 ${target}`);
      else message.warning(r.message);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '测试发送失败');
    }
  }, [form]);

  const onReset = useCallback(async () => {
    try {
      await Promise.all(SMTP_KEYS.map((k) => settingsApi.remove(k).catch(() => undefined)));
      message.success('已清空 SMTP 设置');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '清空失败');
    }
  }, [load]);

  const lastUpdated = useMemo(() => {
    const r = items.filter((x) => x.key.startsWith('smtp.')).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    return r?.updatedAt ? new Date(r.updatedAt).toLocaleString() : null;
  }, [items]);

  return (
    <Card
      title={
        <Space>
          <MailOutlined />
          邮件设置 · 邮件通知
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
          <Button danger onClick={onReset}>清空配置</Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="SMTP 配置保存后立即生效（无需重启服务）。留空时回退到环境变量 / 仅写日志。"
        description={lastUpdated ? `最近更新：${lastUpdated}` : '尚未设置任何 SMTP 项，当前所有邮件仅记录到服务器日志。'}
      />
      <Form form={form} layout="vertical" onFinish={onSave} disabled={saving}>
        <Form.Item name="smtp.host" label="SMTP 主机">
          <Input placeholder="例如 smtp.189.cn / smtp.exmail.qq.com" allowClear />
        </Form.Item>
        <Space size="middle" style={{ display: 'flex' }}>
          <Form.Item name="smtp.port" label="端口" style={{ flex: 1 }}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="smtp.secure" label="SSL/TLS" style={{ flex: 1 }} valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="关闭" />
          </Form.Item>
        </Space>
        <Form.Item name="smtp.user" label="登录账号">
          <Input allowClear />
        </Form.Item>
        <Form.Item name="smtp.pass" label="登录密码 / 授权码">
          <Input.Password placeholder="留空将保留原值不变" autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="smtp.from" label="发件人 (From)">
          <Input placeholder="例如 DocumentFlow <no-reply@example.com>" allowClear />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
          <Button icon={<SendOutlined />} onClick={onTestSend}>发送测试邮件</Button>
        </Space>
      </Form>
    </Card>
  );
}
