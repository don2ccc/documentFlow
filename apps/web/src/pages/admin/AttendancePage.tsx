import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, TimePicker, Tooltip, Typography, Upload, message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  ClockCircleOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, InboxOutlined,
  PlusOutlined, ReloadOutlined, UploadOutlined
} from '@ant-design/icons';
import {
  AttendanceDailyItem, AttendanceResults, AttendanceShiftItem, AttendanceUploadItem,
  attendanceApi, downloadBlob
} from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { brand, statusColor, tokens } from '../../theme';

const STATUS_OPTIONS = [
  { value: '正常', label: '正常' },
  { value: '迟到', label: '迟到' },
  { value: '早退', label: '早退' },
  { value: '迟到/早退', label: '迟到/早退' },
  { value: '缺卡', label: '缺卡' },
  { value: '异常', label: '异常' }
];

const STATUS_TAG_COLOR: Record<string, string> = {
  正常: statusColor.success,
  迟到: '#fa8c16',
  早退: '#fa541c',
  '迟到/早退': statusColor.danger,
  缺卡: '#eb2f96',
  异常: statusColor.danger
};

const hours = (minutes: number) => (minutes / 60).toFixed(2);

const toMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

const segmentsText = (segments: Array<{ start: string; end: string }>) =>
  segments.map((s) => `${s.start}-${s.end}`).join(' / ');

const isCrossDay = (segments: Array<{ start: string; end: string }>) =>
  segments.some((s) => toMinutes(s.end) <= toMinutes(s.start));

const atTime = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return dayjs().hour(h).minute(m).second(0).millisecond(0);
};

interface ShiftFormValues {
  code: string;
  name: string;
  standardMinutes: number;
  active: boolean;
  segments: Array<{ start: Dayjs; end: Dayjs }>;
}

function errMsg(e: any): string {
  return e?.response?.data?.message ?? e?.message ?? '操作失败';
}

export function AttendancePage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('hr:attendance:manage');

  const [shifts, setShifts] = useState<AttendanceShiftItem[]>([]);
  const [uploads, setUploads] = useState<AttendanceUploadItem[]>([]);
  const [uploadId, setUploadId] = useState<string | undefined>();
  const [data, setData] = useState<AttendanceResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string | undefined>();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadShiftId, setUploadShiftId] = useState<string | undefined>();
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<AttendanceShiftItem | null>(null);
  const [savingShift, setSavingShift] = useState(false);
  const [shiftForm] = Form.useForm<ShiftFormValues>();

  const loadMeta = useCallback(async () => {
    try {
      const [shiftList, uploadList] = await Promise.all([
        attendanceApi.listShifts(),
        attendanceApi.listUploads()
      ]);
      setShifts(shiftList);
      setUploads(uploadList);
      setUploadId((prev) => prev ?? uploadList[0]?.id);
      if (!uploadShiftId && shiftList.length) setUploadShiftId(shiftList.find((s) => s.active)?.id);
    } catch (e) {
      message.error(errMsg(e));
    }
  }, [uploadShiftId]);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const loadResults = useCallback(async () => {
    if (!uploadId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await attendanceApi.results({
        uploadId,
        page,
        pageSize,
        keyword: keyword || undefined,
        status,
        dateFrom: range?.[0]?.format('YYYY-MM-DD'),
        dateTo: range?.[1]?.format('YYYY-MM-DD')
      });
      setData(res);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [uploadId, page, pageSize, keyword, status, range]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const currentUpload = useMemo(
    () => data?.upload ?? uploads.find((u) => u.id === uploadId) ?? null,
    [data?.upload, uploads, uploadId]
  );

  const shiftOptions = useMemo(
    () => shifts.map((s) => ({
      value: s.id,
      disabled: !s.active,
      label: `${s.code} ${s.name} · ${segmentsText(s.segments)}${s.active ? '' : '（已停用）'}`
    })),
    [shifts]
  );

  const uploadOptions = useMemo(
    () => uploads.map((u) => ({
      value: u.id,
      label: `${u.fileName} · ${u.periodStart}~${u.periodEnd} · ${u.shiftCode}`
    })),
    [uploads]
  );

  // ---------------- 班次 ----------------

  const openCreateShift = () => {
    setEditingShift(null);
    shiftForm.resetFields();
    shiftForm.setFieldsValue({
      code: '',
      name: '',
      standardMinutes: 480,
      active: true,
      segments: [{ start: atTime('08:00'), end: atTime('17:00') }]
    });
    setShiftOpen(true);
  };

  const openEditShift = (row: AttendanceShiftItem) => {
    setEditingShift(row);
    shiftForm.setFieldsValue({
      code: row.code,
      name: row.name,
      standardMinutes: row.standardMinutes,
      active: row.active,
      segments: row.segments.map((s) => ({ start: atTime(s.start), end: atTime(s.end) }))
    });
    setShiftOpen(true);
  };

  const saveShift = async () => {
    try {
      const values = await shiftForm.validateFields();
      const payload = {
        code: values.code.trim(),
        name: values.name.trim(),
        standardMinutes: values.standardMinutes,
        active: values.active,
        segments: values.segments.map((s) => ({
          start: s.start.format('HH:mm'),
          end: s.end.format('HH:mm')
        }))
      };
      setSavingShift(true);
      if (editingShift) await attendanceApi.updateShift(editingShift.id, payload);
      else await attendanceApi.createShift(payload);
      message.success(editingShift ? '班次已更新' : '班次已创建');
      setShiftOpen(false);
      await loadMeta();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(errMsg(e));
    } finally {
      setSavingShift(false);
    }
  };

  const toggleShift = async (row: AttendanceShiftItem) => {
    try {
      await attendanceApi.updateShift(row.id, { active: !row.active });
      message.success(row.active ? '班次已停用' : '班次已启用');
      await loadMeta();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const removeShift = async (row: AttendanceShiftItem) => {
    try {
      await attendanceApi.removeShift(row.id);
      message.success('班次已删除');
      await loadMeta();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  // ---------------- 上传 ----------------

  const submitUpload = async () => {
    const file = fileList[0]?.originFileObj as File | undefined;
    if (!file) return message.warning('请选择 Excel 文件');
    if (!uploadShiftId) return message.warning('请选择本次计算使用的班次');
    setUploading(true);
    try {
      const res = await attendanceApi.upload(file, uploadShiftId);
      message.success(
        `已解析 ${res.upload.punchCount} 条打卡（${res.upload.employeeCount} 人），生成 ${res.upload.resultCount} 条结果`
      );
      setUploadOpen(false);
      setFileList([]);
      setPage(1);
      setKeyword('');
      setKeywordInput('');
      setStatus(undefined);
      setRange(null);
      await loadMeta();
      setUploadId(res.upload.id);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  const removeUpload = async () => {
    if (!uploadId) return;
    try {
      await attendanceApi.removeUpload(uploadId);
      message.success('批次已删除');
      setUploadId(undefined);
      setData(null);
      await loadMeta();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  // ---------------- 导出 ----------------

  const exportResults = async () => {
    if (!uploadId) return;
    try {
      const blob = await attendanceApi.exportResults(uploadId, {
        keyword: keyword || undefined,
        status,
        dateFrom: range?.[0]?.format('YYYY-MM-DD'),
        dateTo: range?.[1]?.format('YYYY-MM-DD')
      });
      if (blob.type.includes('json')) throw new Error('导出失败，请重试');
      downloadBlob(blob, `考勤结果_${currentUpload?.periodStart ?? ''}_${currentUpload?.periodEnd ?? ''}.xlsx`);
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  // ---------------- 列定义 ----------------

  const resultColumns: ColumnsType<AttendanceDailyItem> = [
    { title: '排班日期', dataIndex: 'workDate', width: 110, fixed: 'left' },
    { title: '工号', dataIndex: 'employeeNo', width: 110 },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    {
      title: '部门', dataIndex: 'department', width: 110, ellipsis: true,
      render: (v: string | null) => v || '-'
    },
    {
      title: '上班', dataIndex: 'firstIn', width: 90,
      render: (v: string | null) => v ? v.slice(0, 5) : '-'
    },
    {
      title: '下班', dataIndex: 'lastOut', width: 90,
      render: (v: string | null) => v ? v.slice(0, 5) : '-'
    },
    { title: '打卡次数', dataIndex: 'punchCount', width: 90, align: 'center' },
    {
      title: '工作时长', dataIndex: 'workMinutes', width: 100, align: 'right',
      render: (v: number) => <strong>{hours(v)} h</strong>
    },
    {
      title: '加班', dataIndex: 'overtimeMinutes', width: 90, align: 'right',
      render: (v: number) => v > 0
        ? <span style={{ color: brand.primary, fontWeight: 600 }}>{hours(v)} h</span>
        : <span style={{ color: tokens.text.muted }}>0</span>
    },
    {
      title: '迟到(分)', dataIndex: 'lateMinutes', width: 90, align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#fa8c16' }}>{v}</span> : '-'
    },
    {
      title: '早退(分)', dataIndex: 'earlyMinutes', width: 90, align: 'right',
      render: (v: number) => v > 0 ? <span style={{ color: '#fa541c' }}>{v}</span> : '-'
    },
    {
      title: '状态', dataIndex: 'status', width: 110,
      render: (v: string) => (
        <Tag color={STATUS_TAG_COLOR[v] ?? 'default'} style={{ marginInlineEnd: 0 }}>{v}</Tag>
      )
    },
    {
      title: '备注', dataIndex: 'abnormal', width: 220, ellipsis: true,
      render: (v: string | null) => v
        ? <Tooltip title={v}><span style={{ color: tokens.text.secondary }}>{v}</span></Tooltip>
        : '-'
    }
  ];

  const shiftColumns: ColumnsType<AttendanceShiftItem> = [
    { title: '编码', dataIndex: 'code', width: 110 },
    { title: '班次名称', dataIndex: 'name', width: 140 },
    {
      title: '班次时间', dataIndex: 'segments',
      render: (segments: AttendanceShiftItem['segments']) => (
        <Space size={6} wrap>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {segmentsText(segments)}
          </span>
          {isCrossDay(segments) && <Tag color="purple">跨天</Tag>}
        </Space>
      )
    },
    {
      title: '标准工时', dataIndex: 'standardMinutes', width: 110, align: 'right',
      render: (v: number) => `${hours(v)} 小时`
    },
    {
      title: '状态', dataIndex: 'active', width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>
    },
    {
      title: '操作', key: 'actions', width: 190,
      render: (_: unknown, row) => canManage ? (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditShift(row)}>编辑</Button>
          <Button size="small" type="link" onClick={() => toggleShift(row)}>{row.active ? '停用' : '启用'}</Button>
          <Popconfirm
            title="删除该班次？"
            description="已被考勤批次使用的班次不能删除，可改为停用。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => removeShift(row)}
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) : <span style={{ color: tokens.text.muted }}>只读</span>
    }
  ];

  // ---------------- 渲染 ----------------

  const summary = data?.summary;

  const analysisTab = (
    <Card
      title="考勤分析"
      extra={(
        <Space wrap>
          {canManage && (
            <Button type="primary" icon={<UploadOutlined />} onClick={() => {
              if (!shifts.length) return message.warning('请先在「班次管理」里新建一个班次');
              setUploadOpen(true);
            }}>
              上传原始数据
            </Button>
          )}
          <Button icon={<DownloadOutlined />} disabled={!uploadId} onClick={exportResults}>导出 Excel</Button>
          {canManage && uploadId && (
            <Popconfirm title="删除该批次及其计算结果？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={removeUpload}>
              <Button danger icon={<DeleteOutlined />}>删除批次</Button>
            </Popconfirm>
          )}
        </Space>
      )}
    >
      {uploads.length === 0 ? (
        <Empty
          image={<InboxOutlined style={{ fontSize: 64, color: tokens.text.muted }} />}
          description={(
            <Space direction="vertical" size={4}>
              <Typography.Text strong>还没有考勤数据</Typography.Text>
              <Typography.Text type="secondary">
                先到「班次管理」建好班次，再上传考勤机导出的原卡数据（Excel）
              </Typography.Text>
            </Space>
          )}
          style={{ padding: '48px 0' }}
        />
      ) : (
        <>
          <Space wrap style={{ marginBottom: tokens.space.md }}>
            <Select
              style={{ width: 380, maxWidth: '100%' }}
              value={uploadId}
              options={uploadOptions}
              onChange={(v) => { setUploadId(v); setPage(1); }}
              placeholder="选择上传批次"
            />
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => {
                setRange(v && v[0] && v[1] ? [v[0], v[1]] : null);
                setPage(1);
              }}
              allowClear
              placeholder={['开始日期', '结束日期']}
            />
            <Input.Search
              style={{ width: 220 }}
              placeholder="工号 / 姓名"
              allowClear
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onSearch={(v) => { setKeyword(v.trim()); setPage(1); }}
            />
            <Select
              style={{ width: 130 }}
              placeholder="状态"
              allowClear
              value={status}
              options={STATUS_OPTIONS}
              onChange={(v) => { setStatus(v); setPage(1); }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => loadResults()}>刷新</Button>
          </Space>

          {currentUpload && (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: tokens.space.md, fontSize: 12 }}>
              当前批次：{currentUpload.fileName} · 班次 {currentUpload.shiftCode} {currentUpload.shiftName} ·
              {' '}{currentUpload.punchCount} 条打卡 / {currentUpload.employeeCount} 人
              {currentUpload.createdByName ? ` · 上传人 ${currentUpload.createdByName}` : ''}
            </Typography.Text>
          )}

          {summary && (
            <Row gutter={[12, 12]} style={{ marginBottom: tokens.space.md }}>
              {[
                { title: '排班人日', value: summary.days, icon: <ClockCircleOutlined />, color: '#2f6fed' },
                { title: '出勤人数', value: summary.employees, icon: <ClockCircleOutlined />, color: '#0ea5e9' },
                { title: '总工时(h)', value: hours(summary.workMinutes), icon: <ClockCircleOutlined />, color: brand.primary },
                { title: '加班(h)', value: hours(summary.overtimeMinutes), icon: <ClockCircleOutlined />, color: '#fa8c16' },
                { title: '迟到人次', value: summary.lateCount, icon: <ClockCircleOutlined />, color: '#fa8c16' },
                { title: '早退人次', value: summary.earlyCount, icon: <ClockCircleOutlined />, color: '#fa541c' },
                { title: '缺卡人次', value: summary.missingCount, icon: <ClockCircleOutlined />, color: '#eb2f96' }
              ].map((item) => (
                <Col key={item.title} xs={12} sm={8} md={6} lg={3}>
                  <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
                    <Statistic
                      title={<span style={{ fontSize: 12, color: tokens.text.secondary }}>{item.title}</span>}
                      value={item.value}
                      valueStyle={{ fontSize: 22, fontWeight: 600, color: item.color }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          <Table
            rowKey="id"
            size="middle"
            loading={loading}
            columns={resultColumns}
            dataSource={data?.items ?? []}
            scroll={{ x: 1340 }}
            pagination={{
              current: page,
              pageSize,
              total: data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100, 200],
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps); }
            }}
            locale={{ emptyText: <Empty description="没有符合条件的记录" /> }}
          />

          <Alert
            style={{ marginTop: tokens.space.md }}
            type="info"
            showIcon
            message="计算规则"
            description={(
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                迟到 / 早退按班次时间严格计算（0 宽限，按分钟向上取整）；工作时长 = 班次各时间段内的打卡交集 + 班次结束后的时间；
                加班 = 工作时长超过标准工时的部分；打卡次数为奇数时标记「缺卡」，工时仍按实际打卡计算；
                跨天班次（如 20:00-08:00）会把次日凌晨的打卡归到前一天。
              </Typography.Text>
            )}
          />
        </>
      )}
    </Card>
  );

  const shiftTab = (
    <Card
      title="班次管理"
      extra={canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreateShift}>新建班次</Button> : null}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: tokens.space.md }}
        message="一个班次可以包含多个时间段（例如上午、下午、晚上），段与段之间是休息时间，不计工时。结束时间早于开始时间表示跨天。"
      />
      <Table
        rowKey="id"
        size="middle"
        columns={shiftColumns}
        dataSource={shifts}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={canManage ? '还没有班次，点击右上角「新建班次」开始配置' : '还没有班次'}
              style={{ padding: '32px 0' }}
            />
          )
        }}
      />
    </Card>
  );

  return (
    <>
      <Tabs
        items={[
          { key: 'analysis', label: '考勤分析', children: analysisTab },
          { key: 'shifts', label: '班次管理', children: shiftTab }
        ]}
      />

      <Modal
        title="上传原始考勤数据"
        open={uploadOpen}
        onOk={submitUpload}
        onCancel={() => { setUploadOpen(false); setFileList([]); }}
        confirmLoading={uploading}
        okText="开始计算"
        cancelText="取消"
        destroyOnHidden
        width={640}
      >
        <Space direction="vertical" size={tokens.space.md} style={{ width: '100%' }}>
          <div>
            <Typography.Text strong>1. 选择班次</Typography.Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={uploadShiftId}
              options={shiftOptions}
              onChange={setUploadShiftId}
              placeholder="本次上传的所有员工按该班次计算"
            />
          </div>
          <div>
            <Typography.Text strong>2. 选择 Excel 文件</Typography.Text>
            <Upload.Dragger
              accept=".xlsx,.xls"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: list }) => setFileList(list.slice(-1))}
              style={{ marginTop: 8 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此处</p>
              <p className="ant-upload-hint">
                支持中控考勤机导出的原卡数据，需包含「姓名」「考勤号码」「日期时间」列，单次最多 10 万条
              </p>
            </Upload.Dragger>
          </div>
          <Alert
            type="warning"
            showIcon
            message="同一份数据重复上传会产生新批次；如需重算，请先删除旧批次。"
          />
        </Space>
      </Modal>

      <Modal
        title={editingShift ? '编辑班次' : '新建班次'}
        open={shiftOpen}
        onOk={saveShift}
        onCancel={() => setShiftOpen(false)}
        confirmLoading={savingShift}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        width={680}
      >
        <Form form={shiftForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="code"
                label="班次编码"
                rules={[
                  { required: true, message: '请输入班次编码' },
                  { pattern: /^[A-Za-z0-9_-]+$/, message: '只能包含字母、数字、下划线和中划线' }
                ]}
              >
                <Input placeholder="例如 M10" maxLength={20} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="name" label="班次名称" rules={[{ required: true, message: '请输入班次名称' }]}>
                <Input placeholder="例如 白班" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="active" label="状态" valuePropName="checked">
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="standardMinutes"
            label="标准工时（分钟）"
            rules={[{ required: true, message: '请输入标准工时' }]}
            extra="超过标准工时的部分计为加班，例如 480 = 8 小时"
          >
            <InputNumber min={60} max={1440} step={30} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="班次时间段" required>
            <Form.List
              name="segments"
              rules={[{
                validator: async (_, value) => {
                  if (!value || !value.length) throw new Error('至少需要一个班次时间段');
                }
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map((field, index) => (
                    <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Tag color="default">第 {index + 1} 段</Tag>
                      <Form.Item
                        name={[field.name, 'start']}
                        rules={[{ required: true, message: '请选择开始时间' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <TimePicker format="HH:mm" minuteStep={5} allowClear={false} placeholder="开始" />
                      </Form.Item>
                      <span style={{ color: tokens.text.muted }}>至</span>
                      <Form.Item
                        name={[field.name, 'end']}
                        rules={[{ required: true, message: '请选择结束时间' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <TimePicker format="HH:mm" minuteStep={5} allowClear={false} placeholder="结束" />
                      </Form.Item>
                      {fields.length > 1 && (
                        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      )}
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ start: atTime('08:00'), end: atTime('12:00') })} block icon={<PlusOutlined />}>
                    添加时间段
                  </Button>
                  <Form.ErrorList errors={errors} />
                </>
              )}
            </Form.List>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              按上班顺序填写；结束时间早于开始时间表示跨天（例如 20:00-00:00）。
            </Typography.Text>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
