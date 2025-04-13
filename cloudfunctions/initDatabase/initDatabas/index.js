// 初始化所有数据库集合
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('开始初始化数据库...')
  const collections = [
    'users',        // 用户信息
    'services',     // 服务项目
    'appointments', // 预约记录
    'therapists',   // 理疗师
    'recharges',    // 充值记录
    'verifications', // 核销记录
    'edit_logs',    // 编辑日志
    'wallet_records', // 钱包记录
    'times_records',  // 次数记录
    'transactions',   // 交易记录
    'staff',          // 员工信息
    'rest_times',     // 休息时间
    'gift_records',   // 赠送记录
    'orders',         // 订单
    'appointment_changes', // 预约变更
    'operation_logs'      // 操作日志
  ]

  const result = {
    created: [],
    existing: [],
    failed: []
  }

  for (const collectionName of collections) {
    try {
      console.log(`尝试创建集合: ${collectionName}`)
      await db.createCollection(collectionName)
      console.log(`成功创建集合: ${collectionName}`)
      result.created.push(collectionName)
    } catch (error) {
      console.error(`创建集合 ${collectionName} 失败:`, error)
      // 如果错误是因为集合已经存在，则添加到existing数组
      if (error.errCode === -502002) {
        console.log(`集合 ${collectionName} 已存在`)
        result.existing.push(collectionName)
      } else {
        result.failed.push({
          name: collectionName,
          error: error.message || error.toString()
        })
      }
    }
  }

  console.log('数据库初始化完成', result)
  return {
    success: true,
    message: '数据库初始化完成',
    result
  }
}