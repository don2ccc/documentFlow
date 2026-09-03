import { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/endpoints';

export function ChangePasswordPage() {
  const { logout, clearMustChangePassword, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!mustChangePassword) navigate('/dashboard', { replace: true });
  }, [mustChangePassword, navigate]);

  const onFinish = async (values: { newPassword: string; confirm: string }) => {
    if (values.newPassword !== values.confirm) {
      message.error('两次输入的密码不一致');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.changePassword(values.newPassword);
      clearMustChangePassword();
      message.success('密码已修改，正在进入系统');
      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      message.error(e?.response?.data?.message || '修改失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>首次登录请修改密码</Typography.Title>
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="管理员已重置您的密码，为了账号安全，请设置一个新密码后再使用系统。" />
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>提交并登录</Button>
          <Button type="link" block onClick={() => { logout(); }} style={{ marginTop: 8 }}>退出登录</Button>
        </Form>
      </Card>
    </div>
  );
}