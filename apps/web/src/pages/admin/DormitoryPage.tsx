import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from "antd";
import {
  ApartmentOutlined, HomeOutlined, ShopOutlined, ToolOutlined, IdcardOutlined, DownloadOutlined,
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, DollarOutlined, ThunderboltOutlined, FileTextOutlined
} from "@ant-design/icons";
import {
  Building, Room, Bed, Asset, Resident, DormitoryOverview,
  MeterReading, Bill, BillArrears, BillStatistics, BillStatus,
  RoomType, BedStatus, AssetType, AssetStatus, ResidentStatus,
  dormitoryApi,
  downloadBlob
} from "../../api/endpoints";
import { formatDateMinute } from "../../utils/datetime";

const ROOM_TYPES: RoomType[] = ["四人间", "双人间", "单人间"];
const BED_STATUSES: BedStatus[] = ["空闲", "已住", "维修中", "禁用"];
const ASSET_TYPES: AssetType[] = ["空调", "床", "柜子", "热水器", "其他"];
const ASSET_STATUSES: AssetStatus[] = ["正常", "损坏", "已报废"];
const RESIDENT_STATUSES: ResidentStatus[] = ["在住", "已退宿"];

const BILL_STATUSES: BillStatus[] = ["待缴费", "部分缴费", "已缴费", "逾期", "作废"];

function billStatusColor(s: BillStatus): string {
  if (s === "已缴费") return "green";
  if (s === "部分缴费") return "gold";
  if (s === "逾期") return "red";
  if (s === "作废") return "default";
  return "orange";
}

function statusColor(s: string) {
  if (s === "已住" || s === "损坏") return "red";
  if (s === "维修中") return "orange";
  if (s === "禁用" || s === "已退宿") return "default";
  return "green";
}

export function DormitoryPage() {
  const [tab, setTab] = useState<"overview"|"buildings"|"rooms"|"beds"|"assets"|"residents"|"meters"|"bills">("overview");
  const [overview, setOverview] = useState<DormitoryOverview | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);

  const refresh = useCallback(async () => {
    const [ov, b, r, bd, a, res] = await Promise.all([
      dormitoryApi.overview(),
      dormitoryApi.listBuildings(),
      dormitoryApi.listRooms(),
      dormitoryApi.listBeds(),
      dormitoryApi.listAssets(),
      dormitoryApi.listResidents()
    ]);
    setOverview(ov); setBuildings(b); setRooms(r); setBeds(bd); setAssets(a); setResidents(res);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Card title="宿舍管理" extra={<Button icon={<ReloadOutlined />} onClick={refresh}>刷新</Button>}>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          ["overview", "概览", <ApartmentOutlined key="i" />],
          ["buildings", "楼桩管理", <HomeOutlined key="i" />],
          ["rooms", "房间管理", <HomeOutlined key="i" />],
          ["beds", "床位管理", <ToolOutlined key="i" />],
          ["assets", "资产管理", <ShopOutlined key="i" />],
          ["residents", "入住登记", <IdcardOutlined key="i" />],
          ["meters", "水电抵表", <ThunderboltOutlined key="i" />],
          ["bills", "费用管理", <DollarOutlined key="i" />]
        ] as const).map(([k, label, icon]) => (
          <Button key={k} type={tab === k ? "primary" : "default"} icon={icon} onClick={() => setTab(k)}>{label}</Button>
        ))}
      </div>

      {tab === "overview" && overview && <Overview overview={overview} residents={residents} />}
      {tab === "buildings" && <BuildingsTab buildings={buildings} onChanged={refresh} />}
      {tab === "rooms" && <RoomsTab buildings={buildings} rooms={rooms} onChanged={refresh} />}
      {tab === "beds" && <BedsTab rooms={rooms} beds={beds} onChanged={refresh} />}
      {tab === "assets" && <AssetsTab rooms={rooms} assets={assets} onChanged={refresh} />}
      {tab === "residents" && <ResidentsTab residents={residents} beds={beds} onChanged={refresh} />}
      {tab === "meters" && <MeterReadingsTab rooms={rooms} onChanged={refresh} />}
      {tab === "bills" && <BillsTab rooms={rooms} residents={residents} onChanged={refresh} />}
    </Card>
  );
}

function Overview({ overview, residents }: { overview: DormitoryOverview; residents: Resident[]; }) {
  return (
    <div>
      <Row gutter={16}>
        {[
          ["楼桩数", overview.buildings, "#1677ff"],
          ["房间数", overview.rooms, "#13c2c2"],
          ["床位总数", overview.beds, "#722ed1"],
          ["已住床位", overview.occupiedBeds, "#fa541c"],
          ["可用床位", overview.availableBeds, "#52c41a"],
          ["在住人员", overview.residents, "#eb2f96"]
        ].map(([label, val, color]) => (
          <Col span={4} key={String(label)} style={{ marginBottom: 16 }}>
            <Card size="small">
              <div style={{ color: "#888" }}>{String(label)}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: String(color) }}>{String(val)}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="最近入住记录" size="small">
        <Table rowKey="id" size="small" dataSource={residents.slice(0, 10)} pagination={false}
          columns={[
            { title: "工号", dataIndex: "employeeNo", width: 100 },
            { title: "姓名", dataIndex: "name", width: 100 },
            { title: "部门", dataIndex: "department", width: 140 },
            { title: "楼桩-房间", render: (_: unknown, x: Resident) => x.buildingName ? `${x.buildingName} ${x.floor}层-${x.roomNo}` : "-" },
            { title: "床位", dataIndex: "bedNo", width: 80 },
            { title: "入住日期", dataIndex: "checkInDate", width: 110 },
            { title: "状态", dataIndex: "status", width: 80, render: (v: ResidentStatus) => <Tag color={statusColor(v)}>{v}</Tag> }
          ]}
        />
      </Card>
    </div>
  );
}

function BuildingsTab({ buildings, onChanged }: { buildings: Building[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [form] = Form.useForm();

  const start = (b?: Building) => { setEditing(b ?? null); form.resetFields(); if (b) form.setFieldsValue(b); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateBuilding(editing.id, v); else await dormitoryApi.createBuilding(v);
    message.success("已保存"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => { await dormitoryApi.removeBuilding(id); message.success("已删除"); onChanged(); };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>新建楼桩</Button>
      </Space>
      <Table rowKey="id" dataSource={buildings} pagination={false} size="small"
        columns={[
          { title: "楼桩名称", dataIndex: "name", width: 180 },
          { title: "地址", dataIndex: "address" },
          { title: "总层数", dataIndex: "totalFloors", width: 100 },
          { title: "备注", dataIndex: "notes" },
          { title: "创建时间", dataIndex: "createdAt", width: 180, render: (v: string) => formatDateMinute(v) },
          { title: "操作", width: 140, render: (_: unknown, b: Building) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(b)}>编辑</Button>
              <Popconfirm title="确认删除该楼桩？" onConfirm={() => remove(b.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "编辑楼桩" : "新建楼桩"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, max: 80 }]}><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="totalFloors" label="总层数" initialValue={1} rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function RoomsTab({ buildings, rooms, onChanged }: { buildings: Building[]; rooms: Room[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form] = Form.useForm();

  const start = (r?: Room) => { setEditing(r ?? null); form.resetFields(); if (r) form.setFieldsValue(r); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateRoom(editing.id, v); else await dormitoryApi.createRoom(v);
    message.success("已保存"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeRoom(id); message.success("已删除"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "删除失败"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>新建房间</Button>
      </Space>
      <Table rowKey="id" dataSource={rooms} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "楼桩", dataIndex: "buildingId", width: 140, render: (id: string) => buildings.find((b) => b.id === id)?.name ?? id },
          { title: "层数", dataIndex: "floor", width: 80 },
          { title: "房间号", dataIndex: "roomNo", width: 100 },
          { title: "类型", dataIndex: "type", width: 100, render: (v: RoomType) => <Tag>{v}</Tag> },
          { title: "床位占用", width: 120, render: (_: unknown, r: Room) => `${r.bedOccupied ?? 0} / ${r.totalBeds}` },
          { title: "备注", dataIndex: "notes" },
          { title: "操作", width: 140, render: (_: unknown, r: Room) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(r)}>编辑</Button>
              <Popconfirm title="确认删除该房间？" onConfirm={() => remove(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "编辑房间" : "新建房间"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="buildingId" label="所属楼桩" rules={[{ required: true }]}>
            <Select options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="floor" label="层数" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="roomNo" label="房间号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="房间类型" rules={[{ required: true }]}>
            <Select options={ROOM_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="totalBeds" label="床位数量"><InputNumber min={1} style={{ width: "100%" }} placeholder="默认按房间类型自动填充" /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function BedsTab({ rooms, beds, onChanged }: { rooms: Room[]; beds: Bed[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bed | null>(null);
  const [form] = Form.useForm();

  const start = (b?: Bed) => { setEditing(b ?? null); form.resetFields(); if (b) form.setFieldsValue(b); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateBed(editing.id, v); else await dormitoryApi.createBed(v);
    message.success("已保存"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeBed(id); message.success("已删除"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "删除失败"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>新增床位</Button>
      </Space>
      <Table rowKey="id" dataSource={beds} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "所在房间", dataIndex: "roomId", width: 180, render: (id: string) => { const r = rooms.find((x) => x.id === id); return r ? `${r.floor}层-${r.roomNo}` : id; } },
          { title: "床位号", dataIndex: "bedNo", width: 100 },
          { title: "状态", dataIndex: "status", width: 100, render: (v: BedStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "备注", dataIndex: "notes" },
          { title: "操作", width: 160, render: (_: unknown, b: Bed) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(b)}>编辑</Button>
              <Popconfirm title="确认删除该床位？" onConfirm={() => remove(b.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "编辑床位" : "新增床位"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="roomId" label="所在房间" rules={[{ required: true }]}>
              <Select options={rooms.map((r) => ({ value: r.id, label: `${r.floor}层-${r.roomNo} (${r.type})` }))} />
            </Form.Item>
          )}
          <Form.Item name="bedNo" label="床位号" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="空闲">
            <Select options={BED_STATUSES.filter((s) => s !== "已住").map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AssetsTab({ rooms, assets, onChanged }: { rooms: Room[]; assets: Asset[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [damageOpen, setDamageOpen] = useState(false);
  const [damageAsset, setDamageAsset] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const [damageForm] = Form.useForm();

  const start = (a?: Asset) => { setEditing(a ?? null); form.resetFields(); if (a) form.setFieldsValue(a); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateAsset(editing.id, v); else await dormitoryApi.createAsset(v);
    message.success("已保存"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => { await dormitoryApi.removeAsset(id); message.success("已删除"); onChanged(); };
  const reportDamage = async () => {
    const v = await damageForm.validateFields();
    if (!damageAsset) return;
    await dormitoryApi.reportDamage(damageAsset.id, v.note ?? "");
    message.success("已上报损坏");
    setDamageOpen(false); setDamageAsset(null); damageForm.resetFields(); onChanged();
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>新增资产</Button>
      </Space>
      <Table rowKey="id" dataSource={assets} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "房间", dataIndex: "roomId", width: 160, render: (id: string) => { const r = rooms.find((x) => x.id === id); return r ? `${r.floor}层-${r.roomNo}` : id; } },
          { title: "名称", dataIndex: "name", width: 140 },
          { title: "类型", dataIndex: "type", width: 90, render: (v: AssetType) => <Tag>{v}</Tag> },
          { title: "品牌", dataIndex: "brand", width: 120 },
          { title: "型号", dataIndex: "model", width: 120 },
          { title: "序列号", dataIndex: "serialNo", width: 140 },
          { title: "购买日期", dataIndex: "purchaseDate", width: 110 },
          { title: "状态", dataIndex: "status", width: 90, render: (v: AssetStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "损坏说明", dataIndex: "damageNote" },
          { title: "操作", width: 220, render: (_: unknown, a: Asset) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(a)}>编辑</Button>
              <Button size="small" type="link" icon={<ExclamationCircleOutlined />} onClick={() => { setDamageAsset(a); damageForm.resetFields(); setDamageOpen(true); }}>损坏登记</Button>
              <Popconfirm title="确认删除该资产？" onConfirm={() => remove(a.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "编辑资产" : "新增资产"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="roomId" label="所在房间" rules={[{ required: true }]}>
              <Select options={rooms.map((r) => ({ value: r.id, label: `${r.floor}层-${r.roomNo} (${r.type})` }))} />
            </Form.Item>
          )}
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="例：1号空调" /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={ASSET_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="brand" label="品牌"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="型号"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="serialNo" label="序列号"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="purchaseDate" label="购买日期"><Input type="date" /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="状态" initialValue="正常">
            <Select options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="damageNote" label="损坏说明"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={damageOpen} title={"损坏登记：" + (damageAsset?.name ?? "")} onCancel={() => setDamageOpen(false)} onOk={reportDamage} destroyOnHidden>
        <Form form={damageForm} layout="vertical">
          <Form.Item name="note" label="损坏描述" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="请描述损坏部位、程度、已采取的措施等" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function ResidentsTab({ residents, beds, onChanged }: { residents: Resident[]; beds: Bed[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [form] = Form.useForm();

  const availableBeds = useMemo(() => beds.filter((b) => b.status === "空闲" || (editing && b.id === editing.bedId)), [beds, editing]);

  const start = (r?: Resident) => { setEditing(r ?? null); form.resetFields(); if (r) form.setFieldsValue(r); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await dormitoryApi.updateResident(editing.id, v);
      else await dormitoryApi.createResident(v);
      message.success("已保存"); setOpen(false); onChanged();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "保存失败"); }
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeResident(id); message.success("已删除"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "删除失败"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>新增入住记录</Button>
        <Button icon={<DownloadOutlined />} onClick={async () => {
          try {
            const blob = await dormitoryApi.exportResidents();
            const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
            downloadBlob(blob, `宿舍人员台账_${ts}.csv`);
            message.success("已导出宿舍人员名单");
          } catch (e: any) { message.error(e?.message ?? "导出失败"); }
        }}>一键导出人员名单</Button>
      </Space>
      <Table rowKey="id" dataSource={residents} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "工号", dataIndex: "employeeNo", width: 100 },
          { title: "姓名", dataIndex: "name", width: 100 },
          { title: "部门", dataIndex: "department", width: 140 },
          { title: "手机", dataIndex: "phone", width: 120 },
          { title: "入职日期", dataIndex: "hireDate", width: 110 },
          { title: "楼桩-房间", width: 180, render: (_: unknown, r: Resident) => r.buildingName ? `${r.buildingName} ${r.floor}层-${r.roomNo}` : "-" },
          { title: "床位", dataIndex: "bedNo", width: 80 },
          { title: "入住日", dataIndex: "checkInDate", width: 110 },
          { title: "退宿日", dataIndex: "checkOutDate", width: 110 },
          { title: "退宿物品查验", dataIndex: "checkOutItemsCheck", width: 160, ellipsis: true },
          { title: "结算费用", dataIndex: "checkOutSettlement", width: 100, align: "right", render: (v: string | null) => v ? Number(v).toFixed(2) : "-" },
          { title: "状态", dataIndex: "status", width: 90, render: (v: ResidentStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "操作", width: 140, render: (_: unknown, r: Resident) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(r)}>编辑</Button>
              <Popconfirm title="确认删除该入住记录？" onConfirm={() => remove(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "编辑入住记录" : "新增入住记录"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden width={640}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="employeeNo" label="工号" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item></Col>
            <Col span={12}><Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="department" label="部门"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="手机"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="hireDate" label="入职日期"><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="bedId" label="分配床位"><Select allowClear options={availableBeds.map((b) => ({ value: b.id, label: `${b.bedNo} 当前空闲` }))} placeholder="选择空闲床位后自动标为已住" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="checkInDate" label="入住日期" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="checkOutDate" label="退宿日期"><Input type="date" placeholder="未退宿留空" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="checkOutItemsCheck" label="退宿物品查验"><Input.TextArea rows={2} placeholder="例：钥匙2把/电卡1张/床垫完好" /></Form.Item></Col>
            <Col span={12}><Form.Item name="checkOutSettlement" label="退宿结算费用"><InputNumber min={0} step={0.01} style={{ width: "100%" }} placeholder="元" /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="状态" initialValue="在住">
            <Select options={RESIDENT_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


// ===================== 抄表 =====================
function MeterReadingsTab({ rooms, onChanged }: { rooms: Room[]; onChanged: () => void }) {
  const [list, setList] = useState<MeterReading[]>([]);
  const [period, setPeriod] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeterReading | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    const data = await dormitoryApi.listMeterReadings(undefined, period || undefined);
    setList(data);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      period: new Date().toISOString().slice(0, 7),
      readingDate: new Date().toISOString().slice(0, 10),
      recordedBy: ""
    });
    setOpen(true);
  };

  const openEdit = (r: MeterReading) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      ...r,
      electricReading: Number(r.electricReading),
      waterReading: Number(r.waterReading),
      publicElectricUsage: Number(r.publicElectricUsage),
      publicWaterUsage: Number(r.publicWaterUsage)
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const body = { ...values };
    if (editing) {
      await dormitoryApi.updateMeterReading(editing.id, body);
      message.success("已更新");
    } else {
      await dormitoryApi.recordMeterReading(body);
      message.success("已录入");
    }
    setOpen(false);
    load();
    onChanged();
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input placeholder="账期 (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
        <Button onClick={load}>查询</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>新增抵表</Button>
      </Space>
      <Table rowKey="id" size="small" dataSource={list} pagination={{ pageSize: 20 }}>
        <Table.Column title="房间" dataIndex="roomId" width={120}
          render={(rid) => {
            const r = rooms.find((x) => x.id === rid);
            return r ? r.roomNo + "车上层" + r.floor : rid.slice(0, 6);
          }} />
        <Table.Column title="账期" dataIndex="period" width={100} />
        <Table.Column title="电表读数" dataIndex="electricReading" width={110} align="right" />
        <Table.Column title="电用量" dataIndex="electricUsage" width={110} align="right" />
        <Table.Column title="水表读数" dataIndex="waterReading" width={110} align="right" />
        <Table.Column title="水用量" dataIndex="waterUsage" width={110} align="right" />
        <Table.Column title="公摊电" dataIndex="publicElectricUsage" width={100} align="right" />
        <Table.Column title="公摊水" dataIndex="publicWaterUsage" width={100} align="right" />
        <Table.Column title="抵表日期" dataIndex="readingDate" width={120} />
        <Table.Column title="抵表人" dataIndex="recordedBy" width={100} />
        <Table.Column title="备注" dataIndex="notes" />
        <Table.Column title="操作" width={150} fixed="right"
          render={(_, r: MeterReading) => (
            <Space>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={async () => { await dormitoryApi.removeMeterReading(r.id); message.success("已删除"); load(); }}>
                <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )} />
      </Table>
      <Modal title={editing ? "编辑抵表" : "新增抵表"} open={open} onCancel={() => setOpen(false)} onOk={submit} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="roomId" label="房间" rules={[{ required: true }]}>
            <Select placeholder="选择房间" options={rooms.map((r) => ({ value: r.id, label: r.buildingName ? r.buildingName + " / " + r.roomNo + " (" + r.floor + "层)" : r.roomNo }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="period" label="账期 (YYYY-MM)" rules={[{ required: true, pattern: /^\d{4}-\d{2}$/ }]}>
            <Input placeholder="2026-09" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="electricReading" label="电表读数 (度)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="waterReading" label="水表读数 (吨)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="publicElectricUsage" label="公摊电用量" initialValue={0}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="publicWaterUsage" label="公摊水用量" initialValue={0}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Form.Item name="readingDate" label="抵表日期" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="recordedBy" label="抵表人"><Input /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ===================== 账单 =====================
function BillsTab({ residents, onChanged }: { rooms: Room[]; residents: Resident[]; onChanged: () => void }) {
  const [list, setList] = useState<Bill[]>([]);
  const [arrears, setArrears] = useState<BillArrears[]>([]);
  const [stats, setStats] = useState<BillStatistics | null>(null);
  const [period, setPeriod] = useState<string>("");
  const [genOpen, setGenOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<(Bill | BillArrears) | null>(null);
  const [genForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const load = useCallback(async () => {
    const [b, arr, st] = await Promise.all([
      dormitoryApi.listBills({ period: period || undefined }),
      dormitoryApi.arrearsList(),
      dormitoryApi.billStatistics(period || undefined)
    ]);
    setList(b); setArrears(arr); setStats(st);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const onGenerate = async () => {
    const values = await genForm.validateFields();
    const res = await dormitoryApi.generateBills(values);
    message.success("已生成 " + res.generated + " 张账单（跳过 " + res.skipped + " 张已存在）");
    setGenOpen(false);
    load();
    onChanged();
  };

  const onPay = async () => {
    if (!payTarget) return;
    const values = await payForm.validateFields();
    await dormitoryApi.markBillPaid(payTarget.id, values.paidAmount, values.notes);
    message.success("已缴费");
    setPayTarget(null);
    load();
    onChanged();
  };

  const openPay = (b: Bill | BillArrears) => {
    setPayTarget(b);
    payForm.resetFields();
    const remain = Number(b.totalAmount) - Number(b.paidAmount);
    payForm.setFieldsValue({ paidAmount: remain > 0 ? Number(remain.toFixed(2)) : 0 });
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats ? ([
          ["账单笔数", stats.billCount, "#1677ff"],
          ["应收总额", stats.totalAmount.toFixed(2) + " 元", "#13c2c2"],
          ["已收总额", stats.paidAmount.toFixed(2) + " 元", "#52c41a"],
          ["欠款总额", stats.arrears.toFixed(2) + " 元", "#ff4d4f"]
        ] as const).map(([k, v, color]) => (
          <Col span={6} key={k as string}>
            <Card size="small"><div style={{ color: "#888" }}>{k}</div><div style={{ color, fontSize: 22, fontWeight: 600 }}>{v}</div></Card>
          </Col>
        )) : null}
      </Row>

      {arrears.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, borderColor: "#ff4d4f" }} title={<span style={{ color: "#ff4d4f" }}>⚠ 累计 {arrears.length} 笔未缴款账单，算上未收金额 {arrears.reduce((s, a) => s + (a.arrears || 0), 0).toFixed(2)} 元</span>}>
          <Table rowKey="id" size="small" dataSource={arrears.slice(0, 10)} pagination={false}>
            <Table.Column title="账期" dataIndex="period" width={100} />
            <Table.Column title="员工" width={140}
              render={(_, a: BillArrears) => a.resident ? (a.resident.name + " (" + a.resident.employeeNo + ")") : "-"} />
            <Table.Column title="部门" width={120}
              render={(_, a: BillArrears) => a.resident?.department ?? "-"} />
            <Table.Column title="住所" width={160}
              render={(_, a: BillArrears) => a.resident?.bed ? (a.resident.bed.room?.building?.name + " / " + a.resident.bed.room?.roomNo + " / " + a.resident.bed.bedNo) : "-"} />
            <Table.Column title="应付" dataIndex="totalAmount" width={100} align="right" />
            <Table.Column title="已付" dataIndex="paidAmount" width={100} align="right" />
            <Table.Column title="欠款" width={100} align="right"
              render={(_, a: BillArrears) => <span style={{ color: "#ff4d4f", fontWeight: 600 }}>{(a.arrears ?? 0).toFixed(2)}</span>} />
            <Table.Column title="状态" dataIndex="status" width={100}
              render={(_, a: BillArrears) => <Tag color={billStatusColor(a.status)}>{a.status}</Tag>} />
            <Table.Column title="操作" width={100}
              render={(_, a: BillArrears) => (
                <Button size="small" type="primary" onClick={() => openPay(a as Bill | BillArrears)}>缴费</Button>
              )} />
          </Table>
        </Card>
      )}

      <Space style={{ marginBottom: 12 }} wrap>
        <Input placeholder="账期 (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
        <Button onClick={load}>查询</Button>
        <Button icon={<DownloadOutlined />} onClick={async () => {
          try {
            const blob = await dormitoryApi.exportBills({ period: period || undefined });
            const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
            downloadBlob(blob, `宿舍账单_${period || "全部"}_${ts}.csv`);
            message.success("已导出财务报表");
          } catch (e: any) { message.error(e?.message ?? "导出失败"); }
        }}>导出财务报表</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          genForm.resetFields();
          genForm.setFieldsValue({
            period: new Date().toISOString().slice(0, 7),
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            electricRate: 0.6, waterRate: 4.0, roomRate: 0
          });
          setGenOpen(true);
        }}>生成账单</Button>
      </Space>
      <Table rowKey="id" size="small" dataSource={list} pagination={{ pageSize: 20 }}>
        <Table.Column title="账期" dataIndex="period" width={100} />
        <Table.Column title="员工" width={140}
          render={(_, b: Bill) => b.resident ? (b.resident.name + " (" + b.resident.employeeNo + ")") : "-"} />
        <Table.Column title="部门" width={120}
          render={(_, b: Bill) => b.resident?.department ?? "-"} />
        <Table.Column title="电费" dataIndex="electricFee" width={100} align="right" />
        <Table.Column title="水费" dataIndex="waterFee" width={100} align="right" />
        <Table.Column title="住宿费" dataIndex="roomFee" width={100} align="right" />
        <Table.Column title="合计" dataIndex="totalAmount" width={110} align="right" />
        <Table.Column title="已付" dataIndex="paidAmount" width={110} align="right" />
        <Table.Column title="状态" dataIndex="status" width={110}
          render={(_, b: Bill) => <Tag color={billStatusColor(b.status)}>{b.status}</Tag>} />
        <Table.Column title="截止" dataIndex="dueDate" width={110} />
        <Table.Column title="操作" width={180} fixed="right"
          render={(_, b: Bill) => (
            <Space>
              {b.status !== "已缴费" && b.status !== "作废" && (
                <Button size="small" type="primary" onClick={() => openPay(b)}>缴费</Button>
              )}
              {b.status !== "已缴费" && (
                <Popconfirm title="确认作废？" onConfirm={async () => { await dormitoryApi.voidBill(b.id); message.success("已作废"); load(); onChanged(); }}>
                  <Button size="small" danger>作废</Button>
                </Popconfirm>
              )}
            </Space>
          )} />
      </Table>

      <Modal title="生成账单" open={genOpen} onCancel={() => setGenOpen(false)} onOk={onGenerate}>
        <Form form={genForm} layout="vertical">
          <Form.Item name="period" label="账期 (YYYY-MM)" rules={[{ required: true, pattern: /^\d{4}-\d{2}$/ }]}><Input /></Form.Item>
          <Form.Item name="electricRate" label="电价 (元/度)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="waterRate" label="水价 (元/吨)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="roomRate" label="住宿费 (元/人/月)" rules={[{ required: true }]}><InputNumber min={0} step={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="dueDate" label="缴费截止日" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="缴费登记" open={!!payTarget} onCancel={() => setPayTarget(null)} onOk={onPay}>
        {payTarget && (
          <div>
            <p>员工：<strong>{payTarget.resident?.name}</strong> ({payTarget.resident?.employeeNo})</p>
            <p>账期：<strong>{payTarget.period}</strong></p>
            <p>应付：<strong>{Number(payTarget.totalAmount).toFixed(2)}</strong> 元，已付 {Number(payTarget.paidAmount).toFixed(2)} 元，本次可缴不超过 {(Number(payTarget.totalAmount) - Number(payTarget.paidAmount)).toFixed(2)} 元</p>
            <Form form={payForm} layout="vertical">
              <Form.Item name="paidAmount" label="本次缴费金额" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
              <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
