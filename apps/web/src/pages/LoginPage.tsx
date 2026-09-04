import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Form, Input, Modal, Steps, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/endpoints';

const COUNTDOWN_SEC = 60;

const LOGIN_PAGE_CSS = `
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  background-image: radial-gradient(circle, #e6e8eb 1px, transparent 1px);
  background-size: 22px 22px;
  background-position: 0 0;
  overflow: auto;
}
.login-page::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #ff6b1a, #ff8c4a);
  z-index: 1;
}
.login-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 16px 24px;
}
.login-card {
  width: 380px;
  max-width: 100%;
  background: #ffffff;
  border-radius: 10px;
  padding: 36px 36px 28px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
}
.login-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 14px;
}
.login-logo-img {
  height: 64px;
  width: auto;
  display: block;
  object-fit: contain;
}
.login-title {
  font-size: 22px;
  font-weight: 600;
  text-align: center;
  color: #1f2937;
  margin: 8px 0 4px;
}
.login-subtitle {
  font-size: 12px;
  text-align: center;
  color: #6b7280;
  margin: 0 0 24px;
}
.login-form .ant-form-item { margin-bottom: 14px; }
.login-form .ant-input-affix-wrapper { padding: 8px 12px; border-radius: 6px; }
.login-remember {
  margin: 4px 0 16px;
  font-size: 13px;
  color: #4b5563;
}
.login-btn.ant-btn-primary,
.login-btn.ant-btn-primary:hover,
.login-btn.ant-btn-primary:focus {
  background: #ff6b1a;
  border-color: #ff6b1a;
  box-shadow: none;
}
.login-btn.ant-btn-primary:active {
  background: #e85f15;
  border-color: #e85f15;
}
.login-links {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  font-size: 13px;
}
.login-links a {
  color: #ff6b1a;
  cursor: pointer;
  text-decoration: none;
}
.login-links a:hover { text-decoration: underline; }
.login-version {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.3px;
}
.login-version .lv-value { color: #475569; font-weight: 500; }
.login-version .lv-commit { opacity: 0.55; margin-left: 4px; }
.login-footer {
  text-align: center;
  padding: 16px 16px 24px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.7;
}
.login-footer .status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  margin-right: 4px;
  vertical-align: middle;
}
.login-footer .divider { margin: 0 6px; color: #cbd5e1; }
@media (max-width: 480px) {
  .login-card { padding: 28px 22px 22px; }
  .login-content { padding-top: 36px; }
}
`;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  const [appVersion, setAppVersion] = useState<{ version: string; commit?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/version.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.version) {
          setAppVersion({ version: data.version, commit: data.commit });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 找回密码
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(0);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [sendingPwd, setSendingPwd] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [forgotForm] = Form.useForm();

  // 新用户注册
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerForm] = Form.useForm();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const openForgot = () => {
    setForgotStep(0);
    setForgotEmail('');
    setCountdown(0);
    forgotForm.resetFields();
    setForgotOpen(true);
  };
  const closeForgot = () => {
    setForgotOpen(false);
  };

  const sendCode = async () => {
    try {
      const { email } = await forgotForm.validateFields(['email']);
      setSendingCode(true);
      await authApi.forgotPasswordSend(email.trim());
      setForgotEmail(email.trim());
      setForgotStep(1);
      setCountdown(COUNTDOWN_SEC);
      message.success('验证码已发送，请查收邮箱（10 分钟内有效）');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '发送失败，请稍后再试');
    } finally {
      setSendingCode(false);
    }
  };

  const submitReset = async () => {
    try {
      const values = await forgotForm.validateFields(['code', 'newPassword', 'confirmPassword']);
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }
      setSendingPwd(true);
      await authApi.resetPassword(forgotEmail, values.code, values.newPassword);
      message.success('密码已重置，请使用新密码登录');
      setForgotStep(2);
      setTimeout(() => {
        setForgotOpen(false);
        forgotForm.resetFields();
      }, 1200);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '重置失败，请检查验证码或稍后再试');
    } finally {
      setSendingPwd(false);
    }
  };

  const resend = async () => {
    if (countdown > 0) return;
    try {
      await forgotForm.validateFields(['email']);
      setSendingCode(true);
      await authApi.forgotPasswordSend(forgotEmail);
      setCountdown(COUNTDOWN_SEC);
      message.success('验证码已重新发送');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || '发送失败');
    } finally {
      setSendingCode(false);
    }
  };

  const openRegister = () => {
    registerForm.resetFields();
    setRegisterOpen(true);
  };
  const closeRegister = () => {
    setRegisterOpen(false);
  };
  const submitRegister = async () => {
    try {
      const values = await registerForm.validateFields();
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }
      setRegisterSubmitting(true);
      await authApi.register({
        username: values.username.trim(),
        password: values.password,
        name: values.name.trim(),
        email: values.email.trim(),
        employeeNo: values.employeeNo?.trim() || undefined,
        directSupervisor: values.directSupervisor?.trim() || undefined,
        workshopId: values.workshopId ?? undefined,
        position: values.position?.trim() || undefined
      });
      message.success('注册申请已提交，请等待系统管理员审批');
      setRegisterOpen(false);
      registerForm.resetFields();
    } catch (e: any) {
      if (e?.errorFields) return;
      const errs = e?.response?.data?.message;
      message.error(Array.isArray(errs) ? errs.join('；') : errs || '注册失败，请稍后再试');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      const result = await login(values.username, values.password, remember);
      if (result.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/dashboard');
      }
    } catch (e: any) {
      const apiMsg = e?.response?.data?.message;
      const fallback = e?.message || '登录失败，请稍后再试';
      message.error(apiMsg || fallback);
    }
  };

  return (
    <>
      <style>{LOGIN_PAGE_CSS}</style>
      <div className="login-page">
        <div className="login-content">
          <div className="login-card">
            <div className="login-logo">
              <img src="/yageo-logo.png" alt="YAGEO" className="login-logo-img" />
            </div>
            <h1 className="login-title">SPO 办公系统 登陆</h1>
            <p className="login-subtitle">企业级统一安全办公门户</p>

            <Form onFinish={onFinish} layout="vertical" className="login-form" requiredMark={false}>
              <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input
                  prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="用户名 / 员工工号"
                  size="large"
                  autoComplete="username"
                />
              </Form.Item>
              <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="密码"
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>

              <div className="login-remember">
                <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)}>
                  记住登录状态
                </Checkbox>
              </div>

              <Button type="primary" htmlType="submit" size="large" block loading={submitting} className="login-btn">
                登录
              </Button>

              <div className="login-links">
                <a onClick={openRegister}>注册账号</a>
                <a onClick={openForgot}>忘记密码？</a>
              </div>

              {appVersion ? (
                <div className="login-version" aria-label="build version">
                  <span>当前版本</span>
                  <span>
                    <span className="lv-value">{appVersion.version}</span>
                    {appVersion.commit ? <span className="lv-commit">· {appVersion.commit.slice(0, 7)}</span> : null}
                  </span>
                </div>
              ) : null}
            </Form>
          </div>
        </div>

        <div className="login-footer">
          <div>© 2025 YAGEO Group · SPO Enterprise Cloud</div>
          <div>
            <span className="status-dot" /> 系统运行正常 <span className="divider">|</span> 推荐使用 Chrome / Edge 访问
          </div>
        </div>
      </div>

      <Modal
        title="注册新账号"
        open={registerOpen}
        onCancel={closeRegister}
        onOk={submitRegister}
        okText="提交申请"
        cancelText="取消"
        confirmLoading={registerSubmitting}
        destroyOnHidden
        width={520}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="提交后账号为「待激活」状态，需系统管理员审批通过后方可登录。审批结果及初始密码会通过您填写的邮箱发送。"
        />
        <Form form={registerForm} layout="vertical" preserve={false}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 位' },
              { pattern: /^[A-Za-z0-9_.-]+$/, message: '只能包含字母、数字、下划线、点、连字符' }
            ]}
          >
            <Input placeholder="字母/数字/下划线，至少 3 位" size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="您的真实姓名" size="large" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入合法邮箱' }
            ]}
          >
            <Input placeholder="name@example.com" size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' }
            ]}
            hasFeedback
          >
            <Input.Password placeholder="至少 8 位" size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="再次输入密码" size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="employeeNo" label="工号（选填）">
            <Input placeholder="工号" size="large" />
          </Form.Item>
          <Form.Item name="position" label="职位（选填）">
            <Input placeholder="如：工程师、主管" size="large" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="找回密码"
        open={forgotOpen}
        onCancel={closeForgot}
        footer={null}
        destroyOnHidden
        width={460}
      >
        <Steps
          size="small"
          current={forgotStep}
          items={[
            { title: '输入邮箱' },
            { title: '验证码 + 新密码' },
            { title: '完成' }
          ]}
          style={{ marginBottom: 20 }}
        />
        <Form form={forgotForm} layout="vertical" preserve={false}>
          {forgotStep === 0 && (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="将向您填写的邮箱发送一次性验证码，用于重置登录密码。"
              />
              <Form.Item
                name="email"
                label="注册邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入合法邮箱' }
                ]}
              >
                <Input placeholder="name@example.com" size="large" autoComplete="email" />
              </Form.Item>
              <Button type="primary" block size="large" onClick={sendCode} loading={sendingCode}>
                发送验证码
              </Button>
            </>
          )}

          {forgotStep === 1 && (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message={`验证码已发送至 ${forgotEmail}（10 分钟内有效）`}
              />
              <Form.Item
                name="code"
                label="邮箱验证码"
                rules={[
                  { required: true, message: '请输入验证码' },
                  { len: 6, message: '验证码为 6 位数字' },
                  { pattern: /^\d{6}$/, message: '验证码为 6 位数字' }
                ]}
              >
                <Input
                  placeholder="6 位数字验证码"
                  size="large"
                  maxLength={6}
                  addonAfter={
                    <a onClick={resend} style={{ pointerEvents: countdown > 0 ? 'none' : 'auto', color: countdown > 0 ? '#999' : '#1677ff' }}>
                      {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
                    </a>
                  }
                />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}
                hasFeedback
              >
                <Input.Password placeholder="至少 8 位" size="large" autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="确认新密码"
                dependencies={['newPassword']}
                hasFeedback
                rules={[
                  { required: true, message: '请再次输入新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    }
                  })
                ]}
              >
                <Input.Password placeholder="再次输入新密码" size="large" autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" block size="large" onClick={submitReset} loading={sendingPwd}>
                重置密码
              </Button>
              <Button type="link" block style={{ marginTop: 6 }} onClick={() => setForgotStep(0)}>
                返回上一步
              </Button>
            </>
          )}

          {forgotStep === 2 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Alert type="success" showIcon message="密码已重置，可以去登录了。" />
            </div>
          )}
        </Form>
      </Modal>
    </>
  );
}