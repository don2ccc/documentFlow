import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  SyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  settingsApi,
  SystemSettingItem,
  SslStatus,
  RenewSslParams
} from '../../api/endpoints';

const SMTP_KEYS = ['smtp.host', 'smtp.port', 'smtp.secure', 'smtp.user', 'smtp.pass', 'smtp.from'] as const;

const DEFAULT_SSL_FORM: Required<Omit<RenewSslParams, never>> = {
  days: 3650,
  country: 'CN',
  state: 'Guangdong',
  city: 'Dongguan',
  organization: 'YAGEO',
  organizationalUnit: 'SPO',
  commonName: ''
};

function describeStatus(status?: string) {
  switch (status) {
    case 'expired':
      return { color: 'red', label: '已过期', icon: <ExclamationCircleOutlined /> };
    case 'expiring':
      return { color: 'orange', label: '即将过期', icon: <ClockCircleOutlined /> };
    case 'warning':
      return { color: 'gold', label: '临近过期', icon: <ClockCircleOutlined /> };
    case 'ok':
      return { color: 'green', label: '正常', icon: <CheckCircleOutlined /> };
    default:
      return { color: 'default', label: '未知', icon: <SyncOutlined spin /> };
  }
}

export function SystemSettingsPage() {
  const [items, setItems] = useState<SystemSettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [ssl, setSsl] = useState<SslStatus | null>(null);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslForm] = Form.useForm();
  const [renewing, setRenewing] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewResult, setRenewResult] = useState<null | { ok: boolean; message?: string; notAfter?: string }>(null);

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

  const loadSsl = useCallback(async () => {
    setSslLoading(true);
    try {
      const s = await settingsApi.sslStatus();
      setSsl(s);
      // Prefill renewal form with current subject's CN if available.
      if (s?.subject) {
        const cnMatch = s.subject.match(/CN=([^,\n/]+)/);
        const orgMatch = s.subject.match(/O=([^,\n/]+)/);
        const ouMatch = s.subject.match(/OU=([^,\n/]+)/);
        const stMatch = s.subject.match(/ST=([^,\n/]+)/);
        const lMatch = s.subject.match(/L=([^,\n/]+)/);
        const cMatch = s.subject.match(/C=([^,\n/]+)/);
        sslForm.setFieldsValue({
          commonName: cnMatch?.[1] ?? DEFAULT_SSL_FORM.commonName,
          organization: orgMatch?.[1] ?? DEFAULT_SSL_FORM.organization,
          organizationalUnit: ouMatch?.[1] ?? DEFAULT_SSL_FORM.organizationalUnit,
          state: stMatch?.[1] ?? DEFAULT_SSL_FORM.state,
          city: lMatch?.[1] ?? DEFAULT_SSL_FORM.city,
          country: cMatch?.[1] ?? DEFAULT_SSL_FORM.country
        });
      } else {
        sslForm.setFieldsValue(DEFAULT_SSL_FORM);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '证书读取失败');
    } finally {
      setSslLoading(false);
    }
  }, [sslForm]);

  useEffect(() => {
    load();
    loadSsl();
  }, [load, loadSsl]);

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

  const openRenewModal = useCallback(async () => {
    await sslForm.validateFields().catch(() => undefined);
    setRenewResult(null);
    setRenewModalOpen(true);
  }, [sslForm]);

  const closeRenewModal = useCallback(() => {
    if (renewing) return;
    setRenewModalOpen(false);
  }, [renewing]);

  const onConfirmRenew = useCallback(async () => {
    let values: any;
    try {
      values = await sslForm.validateFields();
    } catch {
      return;
    }
    setRenewing(true);
    try {
      const r = await settingsApi.renewSsl({
        days: Number(values.days),
        country: values.country,
        state: values.state,
        city: values.city,
        organization: values.organization,
        organizationalUnit: values.organizationalUnit,
        commonName: values.commonName
      });
      setRenewResult({ ok: !!r.ok, message: r.message || r.error, notAfter: r.notAfter });
      if (r.ok) {
        message.success('证书已签发');
        loadSsl();
      } else {
        message.error(r.message || r.error || '签发失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '签发失败';
      setRenewResult({ ok: false, message: msg });
      message.error(msg);
    } finally {
      setRenewing(false);
    }
  }, [sslForm, loadSsl]);

  const sslStatusInfo = describeStatus(ssl?.status);

  const renderSslStatusAlert = () => {
    if (!ssl) return null;
    if (ssl.exists === false) {
      return (
        <Alert
          type="error"
          showIcon
          message="证书文件不存在"
          description={ssl.error || `${ssl.path || '/etc/nginx/ssl/documentflow.crt'} 不存在`}
        />
      );
    }
    if (typeof ssl.daysLeft === 'number') {
      if (ssl.daysLeft < 0) {
        return (
          <Alert
            type="error"
            showIcon
            message={`证书已过期 ${Math.abs(ssl.daysLeft)} 天`}
            description={`有效期至：${ssl.notAfter || '未知'}。HTTPS 无法建立安全连接，建议尽快续签证书。`}
          />
        );
      }
      if (ssl.daysLeft <= 30) {
        return (
          <Alert
            type="warning"
            showIcon
            message={`距离到期 ${ssl.daysLeft} 天后过期`}
            description={`有效期至：${ssl.notAfter || '未知'}。建议在到期前完成证书续签，HTTPS 会中断`}
          />
        );
      }
      if (ssl.daysLeft <= 90) {
        return (
          <Alert
            type="info"
            showIcon
            message={`证书还有 ${ssl.daysLeft} 天有效`}
            description={`有效期至：${ssl.notAfter || '未知'}。可在到期前完成续签`}
          />
        );
      }
      return (
        <Alert
          type="success"
          showIcon
          message={`证书有效，剩余天数 ${ssl.daysLeft} 天`}
          description={`有效期至：${ssl.notAfter || '未知'}。无需任何处理，保持现状`}
        />
      );
    }
    return null;
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            SSL 证书与 HTTPS 状态
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSsl} loading={sslLoading}>刷新</Button>
            <Button type="primary" icon={<SyncOutlined />} onClick={openRenewModal}>
              签发新证书
            </Button>
          </Space>
        }
      >
        <Spin spinning={sslLoading}>
          {renderSslStatusAlert()}
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={14}>
              <Descriptions
                column={1}
                size="small"
                bordered
                items={[
                  { key: 'status', label: '证书状态', children: ssl ? <Tag color={sslStatusInfo.color} icon={sslStatusInfo.icon}>{sslStatusInfo.label}</Tag> : <span style={{ color: '#999' }}>-</span> },
                  { key: 'subject', label: '主题名 (Subject)', children: ssl?.subject ?? '-', span: 1 },
                  { key: 'issuer', label: '签发者 (Issuer)', children: ssl?.issuer ?? '-' },
                  { key: 'selfSigned', label: '自签', children: ssl?.selfSigned ? <Tag>自签名</Tag> : <Tag color="blue">CA 签发</Tag> },
                  { key: 'notBefore', label: '生效时间', children: ssl?.notBefore ? dayjs(ssl.notBefore).format('YYYY-MM-DD HH:mm:ss') : '-' },
                  { key: 'notAfter', label: '失效时间', children: ssl?.notAfter ? dayjs(ssl.notAfter).format('YYYY-MM-DD HH:mm:ss') : '-' },
                  { key: 'daysLeft', label: '剩余天数', children: typeof ssl?.daysLeft === 'number' ? `${ssl.daysLeft} 天` : '-' },
                  { key: 'fingerprint', label: 'SHA-256 指纹', children: ssl?.fingerprint ? <Typography.Text code style={{ fontSize: 12 }}>{ssl.fingerprint}</Typography.Text> : '-' },
                  { key: 'path', label: '证书路径', children: <Typography.Text code style={{ fontSize: 12 }}>{ssl?.path ?? '/etc/nginx/ssl/documentflow.crt'}</Typography.Text> }
                ]}
              />
            </Col>
            <Col xs={24} md={10}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>证书续签与排错</Typography.Title>
              <Typography.Paragraph>
                续签会覆盖服务器上的现有证书文件，执行前请先确认影响范围，签发后需手动 reload nginx：
                旧证书会备份到 <Typography.Text code>/opt/documentflow/backups/ssl/</Typography.Text>。
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                这里签发的是自签名证书，HTTPS 可用但浏览器会提示不受信任；
                如需 CA 机构签发，请联系公司 IT 部门。
              </Typography.Paragraph>
            </Col>
          </Row>
        </Spin>
      </Card>

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

      <Modal
        title="签发新证书"
        open={renewModalOpen}
        onCancel={closeRenewModal}
        confirmLoading={renewing}
        okText={renewResult?.ok ? '完成' : '开始签发'}
        cancelText="取消"
        onOk={() => {
          if (renewResult?.ok) {
            setRenewModalOpen(false);
            return;
          }
          onConfirmRenew();
        }}
        okButtonProps={{ disabled: renewing }}
        maskClosable={false}
        width={620}
      >
        {renewResult?.ok ? (
          <Result
            status="success"
            title="证书签发成功"
            subTitle={
              renewResult.notAfter
                ? `新的有效期至：${dayjs(renewResult.notAfter).format('YYYY-MM-DD HH:mm:ss')}`
                : undefined
            }
          />
        ) : renewResult ? (
          <Result
            status="error"
            title="签发失败"
            subTitle={renewResult.message || '详情见 /opt/documentflow/logs/ssl-renew.log'}
          />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="将覆盖 /etc/nginx/ssl/documentflow.crt 与 documentflow.key，签发后需手动 reload nginx"
              description="旧证书会备份到 /opt/documentflow/backups/ssl/ 下。"
            />
            <Form form={sslForm} layout="vertical" initialValues={DEFAULT_SSL_FORM}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="days" label="有效期" rules={[{ required: true }]}>
                    <InputNumber min={1} max={36500} step={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="country" label="国家 (C)">
                    <Input maxLength={2} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="state" label="省份 (ST)">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="city" label="城市 (L)">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="organization" label="组织 (O)">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="organizationalUnit" label="部门 (OU)">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="commonName"
                label="域名 (CN)"
                rules={[{ required: true, message: '请填写 CN，填写 IP 也可以' }]}
              >
                <Input placeholder="例如 172.17.161.26 或 documentflow.yourcompany.com" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Space>
  );
}