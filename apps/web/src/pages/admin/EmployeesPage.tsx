import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Avatar, Button, Card, Col, DatePicker, Divider, Form, Input, Popconfirm, Row, Select, Space,
  Table, Tag, TreeSelect, Typography, Upload, message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import {
  DeleteOutlined, EditOutlined, IdcardOutlined, PlusOutlined, ReloadOutlined,
  SaveOutlined, UndoOutlined, UploadOutlined, UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DepartmentNode, EmployeeBrief, EmployeeDetail, departmentsApi, employeesApi, workshopsApi
} from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { splitNamePinyin } from '../../utils/pinyin';


/** 工作地点取值，来自旧系统的字符串集合编辑器 */
const WORK_LOCATIONS = ['SPO', 'MPO', 'PSU', 'CPO', 'CDC'];

/** 复刻旧系统 HR_Leave 的入职方式字典 */
const ENTRY_TYPES = [
  { value: '001', label: '001' },
  { value: '002', label: '002' },
  { value: '999', label: '999' }
];

const RETURN_STATUS = [
  { value: 'YES', label: 'YES' },
  { value: 'NO', label: 'NO' }
];

const EDUCATION = ['博士', '硕士', '本科', '大专', '高中', '中专', '初中', '其他'].map((e) => ({ value: e, label: e }));

/**
 * 部门/科室接入系统现有的树。
 * 员工表里存的是名称而非 id（后续要从旧库按字符串导入），所以 value 取 name。
 */
function toTreeData(nodes: DepartmentNode[]): DataNode[] {
  return nodes.map((n) => ({
    title: n.name,
    value: n.name,
    key: n.id,
    children: n.children?.length ? toTreeData(n.children) : undefined
  }));
}

/** 对应旧系统 Mouse_ID：0=未选中 1=查看 2=新增/修改 */
type Mode = 'view' | 'create' | 'edit';

interface FormValues {
  name?: string;
  gender?: string;
  nation?: string;
  birthDate?: dayjs.Dayjs;
  namePinyin?: string;
  namePinyinRest?: string;
  idCardNo?: string;
  idCardAddress?: string;
  employeeNo?: string;
  workLocation?: string;
  phone?: string;
  department?: string;
  workGroup?: string;
  bankNo?: string;
  cardNo?: string;
  joinDate?: dayjs.Dayjs;
  entryType?: string;
  returnedStatus?: string;
  supervisor?: string;
  education?: string;
  major?: string;
  school?: string;
  maritalStatus?: string;
  salary?: string;
  address?: string;
  email?: string;
}

export function EmployeesPage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('hr:manage');
  const [form] = Form.useForm<FormValues>();
  const birthDate = Form.useWatch('birthDate', form);

  const [rows, setRows] = useState<EmployeeBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');
  const [mode, setMode] = useState<Mode>('view');
  const [current, setCurrent] = useState<EmployeeDetail | null>(null);
  const [photoNonce, setPhotoNonce] = useState(0);
  /** 新增模式下先选好照片，等保存拿到 id 后再一并上传 */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [deptTree, setDeptTree] = useState<DataNode[]>([]);
  const [shopTree, setShopTree] = useState<DataNode[]>([]);

  const editable = mode !== 'view';

  /** 部门/科室树只拉一次，供表单下拉使用 */
  useEffect(() => {
    departmentsApi.tree().then((t) => setDeptTree(toTreeData(t))).catch(() => setDeptTree([]));
    workshopsApi.tree().then((t) => setShopTree(toTreeData(t))).catch(() => setShopTree([]));
  }, []);

  /** 年龄随出生日期实时算出，与旧系统 Birth_Date_TextChanged 行为一致 */
  const age = useMemo(() => {
    if (!birthDate) return null;
    const b = dayjs(birthDate);
    return dayjs().diff(b, 'year');
  }, [birthDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await employeesApi.list({
        keyword: keyword || undefined,
        active: activeFilter,
        page,
        pageSize
      });
      setRows(r.items);
      setTotal(r.total);
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, activeFilter, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  /**
   * 拼音姓 / 拼音名由中文姓名自动推导，不再要求人工填写。
   * 一旦用户手动改过其中某个字段，就不再覆盖它 —— 有人会用英文名当「拼音名」
   * （例如现有档案里就是 Billy），自动推导不应该把人写的值冲掉。
   */
  const pinyinTouched = useRef({ surname: false, given: false });
  const resetPinyinTouched = () => { pinyinTouched.current = { surname: false, given: false }; };

  const fillForm = (d: EmployeeDetail) => {
    resetPinyinTouched();
    form.setFieldsValue({
      name: d.name ?? undefined,
      gender: d.gender ?? undefined,
      nation: d.nation ?? undefined,
      birthDate: d.birthDate ? dayjs(d.birthDate) : undefined,
      namePinyin: d.namePinyin ?? undefined,
      namePinyinRest: d.namePinyinRest ?? undefined,
      idCardNo: d.idCardNo ?? undefined,
      idCardAddress: d.idCardAddress ?? undefined,
      employeeNo: d.employeeNo,
      workLocation: d.workLocation ?? undefined,
      phone: d.phone ?? undefined,
      department: d.department ?? undefined,
      workGroup: d.workGroup ?? undefined,
      bankNo: d.bankNo ?? undefined,
      cardNo: d.cardNo ?? undefined,
      joinDate: d.joinDate ? dayjs(d.joinDate) : undefined,
      entryType: d.entryType ?? undefined,
      returnedStatus: d.returnedStatus ?? undefined,
      supervisor: d.supervisor ?? undefined,
      education: d.education ?? undefined,
      major: d.major ?? undefined,
      school: d.school ?? undefined,
      maritalStatus: d.maritalStatus ?? undefined,
      salary: d.salary ?? undefined,
      address: d.address ?? undefined,
      email: d.email ?? undefined
    });
  };

  /** 选中行 -> 查看模式，字段只读 */
  const onSelectRow = async (row: EmployeeBrief) => {
    try {
      const d = await employeesApi.get(row.id);
      setCurrent(d);
      fillForm(d);
      setMode('view');
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '读取详情失败');
    }
  };

  /** 新增 -> 清空并解锁 */
  const onCreate = () => {
    form.resetFields();
    form.setFieldsValue({ gender: '男', joinDate: dayjs() });
    resetPinyinTouched();
    setCurrent(null);
    clearPendingPhoto();
    setMode('create');
  };

  /** 修改 -> 解锁当前记录 */
  const onEdit = () => {
    if (!current) {
      message.warning('请先在下方列表中选择一名员工');
      return;
    }
    setMode('edit');
  };

  /** 撤销 -> 回到查看模式或清空 */
  const onCancel = () => {
    if (current) {
      fillForm(current);
      setMode('view');
    } else {
      form.resetFields();
      setMode('view');
    }
  };

  const onSave = async () => {
    let v: FormValues;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    const payload: Record<string, unknown> = { ...v };
    payload.birthDate = v.birthDate ? v.birthDate.format('YYYY-MM-DD') : null;
    payload.joinDate = v.joinDate ? v.joinDate.format('YYYY-MM-DD') : null;
    // 表单里不出现 age，由后端按出生日期计算
    delete (payload as any).age;

    setSaving(true);
    try {
      const saved = mode === 'edit' && current
        ? await employeesApi.update(current.id, payload as any)
        : await employeesApi.create(payload as any);
      message.success(mode === 'edit' ? '保存成功' : '新增成功');
      setCurrent(saved);
      fillForm(saved);
      setMode('view');
      // 新增时照片是暂存的，这里补传
      if (pendingFile) await doUpload(saved.id, pendingFile);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!current) return;
    try {
      await employeesApi.remove(current.id);
      message.success('已停用该员工档案');
      form.resetFields();
      setCurrent(null);
      setMode('view');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '操作失败');
    }
  };

  const onToggleActive = async () => {
    if (!current) return;
    try {
      const d = await employeesApi.setActive(current.id, !current.active);
      setCurrent(d);
      fillForm(d);
      message.success(d.active ? '已启用' : '已停用');
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '操作失败');
    }
  };

  /** 真正执行上传，失败时保留 pendingFile 让用户重试 */
  const doUpload = async (employeeId: string, file: File): Promise<boolean> => {
    setUploading(true);
    try {
      const d = await employeesApi.uploadPhoto(employeeId, file);
      setCurrent(d);
      setPhotoNonce((n) => n + 1);
      setPendingFile(null);
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      setPendingUrl(null);
      message.success('照片已上传');
      return true;
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '照片上传失败');
      return false;
    } finally {
      setUploading(false);
    }
  };

  /**
   * 已有记录：立即上传。新增时没有 id，先暂存，等保存成功后再传，
   * 与旧系统「先选照片再保存」的流程一致。
   */
  const onPickPhoto = async (file: File) => {
    if (current) return doUpload(current.id, file);
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(file);
    setPendingUrl(URL.createObjectURL(file));
    message.info('照片已选择，保存档案后将自动上传');
    return false;
  };

  const clearPendingPhoto = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(null);
    setPendingUrl(null);
  };

  const columns: ColumnsType<EmployeeBrief> = useMemo(
    () => [
      { title: 'ID', dataIndex: 'idx', key: 'idx', width: 60, render: (_: unknown, __: unknown, i: number) => i + 1 },
      { title: '员工编号', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
      {
        title: '员工姓名',
        dataIndex: 'name',
        key: 'name',
        width: 110,
        render: (v: string, r) => (
          <Space size={4}>
            <span>{v}</span>
            {!r.active && <Tag color="default" style={{ marginInlineEnd: 0 }}>停用</Tag>}
          </Space>
        )
      },
      { title: '部门', dataIndex: 'department', key: 'department', width: 120, render: (v) => v ?? '-' },
      { title: '科室/拉', dataIndex: 'workGroup', key: 'workGroup', width: 120, render: (v) => v ?? '-' },
      {
        title: '入职日期',
        dataIndex: 'joinDate',
        key: 'joinDate',
        width: 110,
        render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '-')
      },
      { title: '考勤卡号', dataIndex: 'cardNo', key: 'cardNo', width: 110, render: (v) => v ?? '-' },
      {
        title: '状态',
        dataIndex: 'active',
        key: 'active',
        width: 80,
        render: (v: boolean) => (v ? <Tag color="green">在职</Tag> : <Tag color="default">停用</Tag>)
      },
      { title: '性别', dataIndex: 'gender', key: 'gender', width: 70, render: (v) => v ?? '-' },
      {
        title: '出生日期',
        dataIndex: 'birthDate',
        key: 'birthDate',
        width: 110,
        render: (v: string | null) => (v ? dayjs(v).format('YYYY-MM-DD') : '-')
      }
    ],
    []
  );

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" styles={{ body: { padding: '10px 16px' } }}>
        <Space wrap size={8}>
          <Button type="primary" icon={<PlusOutlined />} disabled={!canManage} onClick={onCreate}>
            新增
          </Button>
          <Button icon={<EditOutlined />} disabled={!canManage || mode !== 'view'} onClick={onEdit}>
            修改
          </Button>
          <Popconfirm title="确认停用该员工档案？" description="停用后档案保留，可随时恢复。" onConfirm={onDelete}>
            <Button danger icon={<DeleteOutlined />} disabled={!canManage || !current || !current.active}>
              删除
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<SaveOutlined />} disabled={!canManage || !editable} loading={saving} onClick={onSave}>
            保存
          </Button>
          <Button icon={<UndoOutlined />} disabled={!editable} onClick={onCancel}>
            撤销
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            刷新
          </Button>
          <Divider type="vertical" />
          <Typography.Text type={editable ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
            {mode === 'create' ? '新增模式：填写后点保存' : mode === 'edit' ? `修改模式：${current?.name}` : '查看模式：选择记录后可修改'}
          </Typography.Text>
        </Space>
      </Card>

      <Card
        size="small"
        title={<Space><IdcardOutlined />员工入职基本信息</Space>}
        extra={
          current && !current.active && canManage ? (
            <Button size="small" onClick={onToggleActive}>恢复在职</Button>
          ) : null
        }
      >
        <Row gutter={16}>
          <Col span={19}>
            <Form form={form} layout="horizontal" labelCol={{ span: 7 }} wrapperCol={{ span: 17 }} disabled={!editable}>
              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="name" label="姓名" rules={[{ required: true, message: '姓名必须填写' }]}>
                    <Input
                      placeholder="姓名"
                      onChange={(e) => {
                        const { surname, given } = splitNamePinyin(e.target.value);
                        const patch: Record<string, string> = {};
                        if (!pinyinTouched.current.surname) patch.namePinyin = surname;
                        if (!pinyinTouched.current.given) patch.namePinyinRest = given;
                        form.setFieldsValue(patch);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="gender" label="性别" rules={[{ required: true, message: '性别必须填写' }]}>
                    <Select options={[{ value: '男' }, { value: '女' }]} placeholder="性别" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="nation" label="民族">
                    <Input placeholder="民族" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="birthDate" label="出生日期" rules={[{ required: true, message: '出生日期必须填写' }]}>
                    <DatePicker style={{ width: '100%' }} placeholder="出生日期" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="namePinyin" label="拼音姓">
                    <Input placeholder="由姓名自动生成" onChange={() => { pinyinTouched.current.surname = true; }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="namePinyinRest" label="拼音名">
                    <Input placeholder="由姓名自动生成" onChange={() => { pinyinTouched.current.given = true; }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item
                    name="idCardNo"
                    label="身份证号"
                    rules={[
                      { required: true, message: '身份证编号必须填写' },
                      { len: 18, message: '身份证号必须是 18 位' }
                    ]}
                  >
                    <Input maxLength={18} placeholder="身份证编号" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="idCardAddress" label="身份证地址" rules={[{ required: true, message: '出生地址必须填写' }]}>
                    <Input placeholder="身份证地址" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item
                    name="employeeNo"
                    label="员工编号"
                    rules={[
                      { required: true, message: '员工编号必须填写' },
                      { len: 8, message: '员工编号必须是 8 位' },
                      { pattern: /^[0-9A-Za-z]+$/, message: '只能包含字母和数字' }
                    ]}
                  >
                    <Input maxLength={8} placeholder="8 位" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="员工年龄">
                    <Input value={age ?? ''} readOnly placeholder="自动计算" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="workLocation" label="工作地点">
                    <Select
                      allowClear
                      showSearch
                      placeholder="工作地点"
                      options={WORK_LOCATIONS.map((v) => ({ value: v, label: v }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="phone" label="联系电话">
                    <Input placeholder="联系电话" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="department" label="入职部门">
                    <TreeSelect
                      allowClear
                      showSearch
                      treeNodeFilterProp="title"
                      placeholder={deptTree.length ? '入职部门' : '系统尚未配置部门'}
                      treeData={deptTree}
                      treeDefaultExpandAll
                      notFoundContent={deptTree.length ? undefined : '请先在「部门管理」中维护'}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="workGroup" label="科室/拉">
                    <TreeSelect
                      allowClear
                      showSearch
                      treeNodeFilterProp="title"
                      placeholder={shopTree.length ? '科室 / 拉' : '系统尚未配置科室'}
                      treeData={shopTree}
                      treeDefaultExpandAll
                      notFoundContent={shopTree.length ? undefined : '请先在「科室管理」中维护'}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="bankNo" label="银行卡号">
                    <Input placeholder="银行卡号" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="cardNo" label="考勤卡号">
                    <Input placeholder="考勤卡号" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="joinDate" label="入职日期">
                    <DatePicker style={{ width: '100%' }} placeholder="入职日期" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="entryType" label="入职方式">
                    <Select options={ENTRY_TYPES} placeholder="001 / 002 / 999" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="returnedStatus" label="返厂状态">
                    <Select options={RETURN_STATUS} placeholder="返厂状态" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="supervisor" label="直接主管">
                    <Input placeholder="直接主管" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="education" label="学历">
                    <Select options={EDUCATION} placeholder="学历" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="school" label="毕业学校">
                    <Input placeholder="毕业学校" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="major" label="专业">
                    <Input placeholder="专业" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="maritalStatus" label="婚姻状况">
                    <Input placeholder="婚姻状况" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={6}>
                  <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '请输入合法邮箱' }]}>
                    <Input placeholder="邮箱" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="address" label="现住址">
                    <Input placeholder="现住址" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="salary" label="薪资">
                    <Input placeholder="选填" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="&nbsp;">
                    <Alert
                      type="warning"
                      showIcon
                      banner
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      message="读卡设备需在本地客户端使用"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Col>

          <Col span={5}>
            <Card size="small" styles={{ body: { padding: 12, textAlign: 'center' } }}>
              {pendingUrl ? (
                <Avatar shape="square" size={160} src={pendingUrl} style={{ border: '2px dashed #faad14' }} />
              ) : current?.hasPhoto ? (
                <Avatar
                  shape="square"
                  size={160}
                  src={`${employeesApi.photoUrl(current.id)}?t=${photoNonce}`}
                  style={{ border: '2px solid #1677ff' }}
                />
              ) : (
                <Avatar shape="square" size={160} icon={<UserOutlined style={{ fontSize: 64 }} />} style={{ background: '#f0f2f5', color: '#bfbfbf' }} />
              )}
              {pendingUrl && (
                <div style={{ marginTop: 8 }}>
                  <Tag color="orange" icon={<UploadOutlined />}>待保存</Tag>
                  {canManage && (
                    <Button type="link" size="small" onClick={clearPendingPhoto}>
                      移除
                    </Button>
                  )}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <Upload
                  accept="image/jpeg,image/png,image/gif"
                  showUploadList={false}
                  beforeUpload={onPickPhoto}
                  disabled={!canManage || mode === 'view'}
                >
                  <Button
                    icon={<UploadOutlined />}
                    loading={uploading}
                    disabled={!canManage || mode === 'view'}
                    block
                  >
                    {current ? '上传照片' : '选择照片'}
                  </Button>
                </Upload>
                {!canManage && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    无 hr:manage 权限，仅可查看
                  </Typography.Text>
                )}
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        size="small"
        title="员工列表"
        extra={
          <Space>
            <Input
              allowClear
              size="small"
              style={{ width: 220 }}
              placeholder="工号 / 姓名 / 拼音 / 电话 / 卡号"
              onPressEnter={() => { setPage(1); load(); }}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              size="small"
              style={{ width: 110 }}
              value={activeFilter}
              onChange={(v) => { setActiveFilter(v); setPage(1); }}
              options={[
                { value: 'true', label: '在职' },
                { value: 'false', label: '已停用' },
                { value: '', label: '全部' }
              ]}
            />
            <Button size="small" type="primary" onClick={() => { setPage(1); load(); }}>查询</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1000 }}
          rowClassName={(r) => (current?.id === r.id ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => onSelectRow(r), style: { cursor: 'pointer' } })}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); }
          }}
        />
      </Card>
    </Space>
  );
}