import { useCallback, useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, Select, Space, Table, Tag, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { applicationsApi, categoriesApi, ApplicationQueryItem, CategoryItem, Paged } from '../api/endpoints';
import { StatusTag } from '../components/StatusTag';

const STATUS_OPTIONS = [
  { value: 'draft', label: '草稿' },
  { value: 'in_approval', label: '审批中' },
  { value: 'archived', label: '已通过' },
  { value: 'rejected', label: '已驳回' }
];

const SCOPE_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'created', label: '我创建的' },
  { value: 'reviewed', label: '我审核过的' }
];

interface FilterValues {
  keyword?: string;
  status?: string;
  categoryId?: string;
  dateRange?: [Dayjs, Dayjs] | null;
  scope?: string;
}

export function ApplicationQueryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Paged<ApplicationQueryItem>>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [filters, setFilters] = useState<FilterValues>({ scope: 'all' });
  const [form] = Form.useForm<FilterValues>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = {
          keyword: filters.keyword || undefined,
          status: filters.status,
          categoryId: filters.categoryId,
          scope: filters.scope,
          page,
          pageSize: 20
        };
        if (filters.dateRange && filters.dateRange.length === 2) {
          params.startDate = filters.dateRange[0].startOf('day').toISOString();
          params.endDate = filters.dateRange[1].endOf('day').toISOString();
        }
        const list = await applicationsApi.query(params);
        setData(list);
      } catch (e: any) {
        const msg = e?.response?.data?.message || '加载申请查询失败';
        message.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const onSearch = (vals: FilterValues) => {
    setFilters({
      scope: vals.scope || 'all',
      keyword: vals.keyword,
      status: vals.status,
      categoryId: vals.categoryId,
      dateRange: vals.dateRange
    });
  };

  const onReset = () => {
    form.resetFields();
    form.setFieldsValue({ scope: 'all' });
    setFilters({ scope: 'all' });
  };

  const columns = [
    {
      title: '申请单号',
      dataIndex: 'id',
      width: 140,
      render: (id: string) => <span style={{ fontFamily: 'monospace' }}>{id.slice(0, 8).toUpperCase()}</span>
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (v: string, r: ApplicationQueryItem) => <a onClick={() => navigate(`/applications/${r.id}`)}>{v}</a>
    },
    {
      title: '类型',
      dataIndex: 'categoryName',
      width: 120,
      render: (v: string | null) => (v ? <Tag color="cyan">{v}</Tag> : <span style={{ color: '#bbb' }}>-</span>)
    },
    {
      title: '创建人',
      dataIndex: 'ownerName',
      width: 110,
      render: (v: string | null) => v || '-'
    },
    {
      title: '当前节点',
      dataIndex: 'currentNodeName',
      width: 140,
      render: (v: string | null) => v || <span style={{ color: '#bbb' }}>-</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} />
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => v.slice(0, 16).replace('T', ' ')
    },
    {
      title: '操作',
      width: 90,
      render: (_: unknown, r: ApplicationQueryItem) => (
        <Button size="small" type="link" onClick={() => navigate(`/applications/${r.id}`)}>查看</Button>
      )
    }
  ];

  return (
    <div>
      <Card title="申请查询" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={onSearch} initialValues={{ scope: 'all' }}>
          <Form.Item name="keyword">
            <Input placeholder="搜索标题" style={{ width: 200 }} allowClear />
          </Form.Item>
          <Form.Item name="status">
            <Select placeholder="状态" allowClear style={{ width: 140 }} options={STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="categoryId">
            <Select
              placeholder="申请类型"
              allowClear
              style={{ width: 160 }}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="dateRange">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="scope" initialValue="all">
            <Select placeholder="范围" style={{ width: 140 }} options={SCOPE_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={onReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns as any}
          dataSource={data.items}
          pagination={{
            total: data.total,
            pageSize: data.pageSize,
            current: data.page,
            onChange: load,
            showSizeChanger: false
          }}
        />
      </Card>
    </div>
  );
}
