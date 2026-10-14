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
      return { color: 'red', label: '???', icon: <ExclamationCircleOutlined /> };
    case 'expiring':
      return { color: 'orange', label: '????', icon: <ClockCircleOutlined /> };
    case 'warning':
      return { color: 'gold', label: '????', icon: <ClockCircleOutlined /> };
    case 'ok':
      return { color: 'green', label: '??', icon: <CheckCircleOutlined /> };
    default:
      return { color: 'default', label: '??', icon: <SyncOutlined spin /> };
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
      message.error(e?.response?.data?.message ?? '??????');
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
      message.success('????????????');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '????');
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const onTestSend = useCallback(async () => {
    const fromField = form.getFieldValue('smtp.from');
    const fallback = (typeof fromField === 'string' ? fromField.match(/<([^>]+)>/)?.[1] : null) || 'test@example.com';
    const target = window.prompt('????????????', fallback);
    if (!target) return;
    try {
      const r = await settingsApi.testEmail(target);
      if (r.ok) message.success(`??????? ${target}`);
      else message.warning(r.message);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '??????');
    }
  }, [form]);

  const onReset = useCallback(async () => {
    try {
      await Promise.all(SMTP_KEYS.map((k) => settingsApi.remove(k).catch(() => undefined)));
      message.success('??? SMTP ??');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '????');
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
        message.success('?????');
        loadSsl();
      } else {
        message.error(r.message || r.error || '????');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '????';
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
          message="???????"
          description={ssl.error || `${ssl.path || '/etc/nginx/ssl/documentflow.crt'} ???`}
        />
      );
    }
    if (typeof ssl.daysLeft === 'number') {
      if (ssl.daysLeft < 0) {
        return (
          <Alert
            type="error"
            showIcon
            message={`????? ${Math.abs(ssl.daysLeft)} ?`}
            description={`?????${ssl.notAfter || '??'}?HTTPS ??????????????????`}
          />
        );
      }
      if (ssl.daysLeft <= 30) {
        return (
          <Alert
            type="warning"
            showIcon
            message={`???? ${ssl.daysLeft} ????`}
            description={`?????${ssl.notAfter || '??'}???????????? HTTPS ???`}
          />
        );
      }
      if (ssl.daysLeft <= 90) {
        return (
          <Alert
            type="info"
            showIcon
            message={`???? ${ssl.daysLeft} ???`}
            description={`?????${ssl.notAfter || '??'}??????????`}
          />
        );
      }
      return (
        <Alert
          type="success"
          showIcon
          message={`????????? ${ssl.daysLeft} ?`}
          description={`?????${ssl.notAfter || '??'}????????????`}
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
            SSL ?? ? ??? HTTPS ??
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSsl} loading={sslLoading}>??</Button>
            <Button type="primary" icon={<SyncOutlined />} onClick={openRenewModal}>
              ?????
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
                  { key: 'status', label: '????', children: ssl ? <Tag color={sslStatusInfo.color} icon={sslStatusInfo.icon}>{sslStatusInfo.label}</Tag> : <span style={{ color: '#999' }}>?</span> },
                  { key: 'subject', label: '??? (Subject)', children: ssl?.subject ?? '?', span: 1 },
                  { key: 'issuer', label: '??? (Issuer)', children: ssl?.issuer ?? '?' },
                  { key: 'selfSigned', label: '??', children: ssl?.selfSigned ? <Tag>???</Tag> : <Tag color="blue">CA ??</Tag> },
                  { key: 'notBefore', label: '????', children: ssl?.notBefore ? dayjs(ssl.notBefore).format('YYYY-MM-DD HH:mm:ss') : '?' },
                  { key: 'notAfter', label: '????', children: ssl?.notAfter ? dayjs(ssl.notAfter).format('YYYY-MM-DD HH:mm:ss') : '?' },
                  { key: 'daysLeft', label: '????', children: typeof ssl?.daysLeft === 'number' ? `${ssl.daysLeft} ?` : '?' },
                  { key: 'fingerprint', label: 'SHA-256 ??', children: ssl?.fingerprint ? <Typography.Text code style={{ fontSize: 12 }}>{ssl.fingerprint}</Typography.Text> : '?' },
                  { key: 'path', label: '????', children: <Typography.Text code style={{ fontSize: 12 }}>{ssl?.path ?? '/etc/nginx/ssl/documentflow.crt'}</Typography.Text> }
                ]}
              />
            </Col>
            <Col xs={24} md={10}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>???????</Typography.Title>
              <Typography.Paragraph>
                ?????????????????????????? reload nginx?
                ?????????? <Typography.Text code>/opt/documentflow/backups/ssl/</Typography.Text>?
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                ???????????????HTTPS ???????????????/????
                ???? CA ?????????? IT ?????
              </Typography.Paragraph>
            </Col>
          </Row>
        </Spin>
      </Card>

      <Card
        title={
          <Space>
            <MailOutlined />
            ???? ? ????
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>??</Button>
            <Button danger onClick={onReset}>????</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="SMTP ???????????????????????????? / ?????"
          description={lastUpdated ? `?????${lastUpdated}` : '?????? SMTP ??????????????????'}
        />
        <Form form={form} layout="vertical" onFinish={onSave} disabled={saving}>
          <Form.Item name="smtp.host" label="SMTP ??">
            <Input placeholder="?? smtp.189.cn / smtp.exmail.qq.com" allowClear />
          </Form.Item>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="smtp.port" label="??" style={{ flex: 1 }}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="smtp.secure" label="SSL/TLS" style={{ flex: 1 }} valuePropName="checked">
              <Switch checkedChildren="??" unCheckedChildren="??" />
            </Form.Item>
          </Space>
          <Form.Item name="smtp.user" label="????">
            <Input allowClear />
          </Form.Item>
          <Form.Item name="smtp.pass" label="???? / ???">
            <Input.Password placeholder="?????????" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="smtp.from" label="??? (From)">
            <Input placeholder="?? DocumentFlow <no-reply@example.com>" allowClear />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>??</Button>
            <Button icon={<SendOutlined />} onClick={onTestSend}>??????</Button>
          </Space>
        </Form>
      </Card>

      <Modal
        title="?????"
        open={renewModalOpen}
        onCancel={closeRenewModal}
        confirmLoading={renewing}
        okText={renewResult?.ok ? '???' : '????'}
        cancelText="??"
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
            title="???????"
            subTitle={
              renewResult.notAfter
                ? `????????${dayjs(renewResult.notAfter).format('YYYY-MM-DD HH:mm:ss')}`
                : undefined
            }
          />
        ) : renewResult ? (
          <Result
            status="error"
            title="????"
            subTitle={renewResult.message || '??? /opt/documentflow/logs/ssl-renew.log'}
          />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="???????? /etc/nginx/ssl/documentflow.crt ? documentflow.key ? reload nginx"
              description="????????? /opt/documentflow/backups/ssl/?"
            />
            <Form form={sslForm} layout="vertical" initialValues={DEFAULT_SSL_FORM}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="days" label="????" rules={[{ required: true }]}>
                    <InputNumber min={1} max={36500} step={30} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="country" label="?? (C)">
                    <Input maxLength={2} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="state" label="?? (ST)">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="city" label="?? (L)">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="organization" label="?? (O)">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="organizationalUnit" label="?? (OU)">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="commonName"
                label="???? (CN)"
                rules={[{ required: true, message: '??? CN??????? IP' }]}
              >
                <Input placeholder="?? 172.17.161.26 ? documentflow.yourcompany.com" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Space>
  );
}
