import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, TreeSelect, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { departmentsApi, usersApi, UserItem } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

interface ProfileFormValues {
  employeeNo?: string;
  email?: string;
  directSupervisor?: string;
  productionLine?: string;
  position?: string;
  departmentId?: string;
}

interface PasswordFormValues {
  newPassword?: string;
  confirmPassword?: string;
}

export function AccountSettingsPage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserItem | null>(null);
  const [depts, setDepts] = useState<any[]>([]);
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    const [me, tree] = await Promise.all([usersApi.getMe(), departmentsApi.tree()]);
    setProfile(me);
    setDepts(tree);
    profileForm.setFieldsValue({
      employeeNo: me.employeeNo ?? '',
      email: me.email ?? '',
      directSupervisor: me.directSupervisor ?? '',
      productionLine: me.productionLine ?? '',
      position: me.position ?? '',
      departmentId: me.departmentId ?? undefined
    });
  }, [profileForm]);

  useEffect(() => {
    load().catch((e: any) => message.error(e?.response?.data?.message || '加载资料失败'));
  }, [load]);

  const saveProfile = async () => {
    const values = await profileForm.validateFields();
    setSavingProfile(true);
    try {
      const updated = await usersApi.updateMe({
        employeeNo: values.employeeNo?.trim() ?? null,
        email: values.email?.trim() ?? null,
        directSupervisor: values.directSupervisor?.trim() ?? null,
        productionLine: values.productionLine?.trim() ?? null,
        position: values.position?.trim() ?? null,
        departmentId: values.departmentId ?? null
      });
      setProfile(updated);
      message.success('资料已保存');
    } catch (e: any) {
      message.error(e?.response?.data?.message || '保存失败，请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    const values = await passwordForm.validateFields();
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致，请检查后重试');
      return;
    }
    setSavingPassword(true);
    try {
      await usersApi.changeMyPassword(values.newPassword!);
      message.success('密码已修改，请使用新密码重新登录');
      passwordForm.resetFields();
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 800);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '修改失败，请重试');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Card title="帐号设置" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="用户名与姓名不可修改（系统标识）。如需变更请联系管理员。"
        />
        <Form form={profileForm} layout="vertical">
          <Form.Item label="用户名">
            <Input value={profile?.username ?? user?.username ?? ''} disabled />
          </Form.Item>
          <Form.Item label="姓名">
            <Input value={profile?.name ?? user?.name ?? ''} disabled />
          </Form.Item>
          <Form.Item name="employeeNo" label="工号">
            <Input placeholder="请输入工号" allowClear />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入合法邮箱' }]}>
            <Input placeholder="name@example.com" allowClear />
          </Form.Item>
          <Form.Item name="directSupervisor" label="直属领导">
            <Input placeholder="请输入直属领导姓名" allowClear />
          </Form.Item>
          <Form.Item name="productionLine" label="生产线">
            <Input placeholder="请输入生产线" allowClear />
          </Form.Item>
          <Form.Item name="position" label="职位信息">
            <Input placeholder="请输入职位信息" allowClear />
          </Form.Item>
          <Form.Item name="departmentId" label="部门">
            <TreeSelect
              treeData={depts}
              fieldNames={{ label: 'name', value: 'id' }}
              allowClear
              placeholder="请选择所属部门"
            />
          </Form.Item>
          <Button type="primary" onClick={saveProfile} loading={savingProfile}>
            保存资料
          </Button>
        </Form>
      </Card>

      <Card title={<><LockOutlined /> 修改密码</>}>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="两次输入的密码必须一致才能生效。修改成功后需要重新登录。"
        />
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            hasFeedback
            rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}
          >
            <Input.Password autoComplete="new-password" placeholder="至少 8 位" />
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
            <Input.Password autoComplete="new-password" placeholder="再次输入新密码" />
          </Form.Item>
          <Button type="primary" onClick={changePassword} loading={savingPassword}>
            修改密码
          </Button>
        </Form>
      </Card>
    </div>
  );
}