// 初始化所有数据库集合
const collections = [
  {
    name: 'users',        // 用户信息
    data: []
  },
  {
    name: 'services',     // 服务项目
    data: [
      {
        name: "基础拉伸60分钟",
        category: "basic",
        duration: 60,
        price: 299,
        description: "舒缓身体疲劳，放松肌肉",
        status: "active",
        sort: 1
      },
      // ... 其他服务
    ]
  },
  {
    name: 'appointments', // 预约记录
    data: []
  },
  {
    name: 'therapists',   // 理疗师
    data: []
  },
  {
    name: 'recharges',    // 充值记录
    data: []
  },
  {
    name: 'verifications', // 核销记录
    data: []
  }
]