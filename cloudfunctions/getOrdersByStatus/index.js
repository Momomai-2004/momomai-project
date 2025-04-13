// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  // 解析参数
  const { status, includeExpired = false, onlyExpired = false } = event
  const openid = wxContext.OPENID
  
  try {
    if (!status) {
      return {
        success: false,
        errMsg: '缺少订单状态参数'
      }
    }
    
    console.log(`查询${status}状态的订单，包含过期：${includeExpired}，仅过期：${onlyExpired}`)
    
    // 构建查询条件
    let whereCondition = {
      _openid: openid,
      status: status
    }
    
    // 多集合查询结果
    let allOrders = []
    
    // 尝试查询可能存在的集合
    const tryCollections = ['orders', 'appointments']
    
    for (const collection of tryCollections) {
      try {
        // 检查集合是否存在
        const checkResult = await cloud.callFunction({
          name: 'checkCollection',
          data: {
            collection: collection
          }
        })
        
        if (checkResult.result && checkResult.result.exists) {
          console.log(`集合 ${collection} 存在，查询数据`)
          
          // 查询该集合中的订单
          const result = await db.collection(collection)
            .where(whereCondition)
            .get()
          
          // 为每个订单标记其所在集合
          const ordersWithCollection = result.data.map(order => ({
            ...order,
            _collection: collection
          }))
          
          allOrders = [...allOrders, ...ordersWithCollection]
        } else {
          console.log(`集合 ${collection} 不存在，跳过`)
        }
      } catch (err) {
        console.error(`查询集合 ${collection} 出错:`, err)
      }
    }
    
    console.log(`查询到 ${allOrders.length} 个 ${status} 状态的订单`)
    
    // 对于已支付订单，过滤出已过期（服务时间+服务时长）的订单
    if (status === 'paid' && (includeExpired || onlyExpired)) {
      const now = new Date()
      
      // 如果只要过期订单，则过滤出过期的
      if (onlyExpired) {
        allOrders = allOrders.filter(order => {
          try {
            const appointmentDate = order.appointment_date
            const timeSlot = order.time_slot
            
            if (appointmentDate && timeSlot) {
              // 解析预约日期和时间
              const [year, month, day] = appointmentDate.split('-').map(Number)
              const [hours, minutes] = timeSlot.split(':').map(Number)
              
              // 创建预约时间对象
              const appointmentDateTime = new Date(year, month - 1, day, hours, minutes)
              
              // 获取服务时长（默认60分钟）
              const serviceDuration = order.service_duration || 60
              
              // 计算服务结束时间
              const serviceEndTime = new Date(appointmentDateTime.getTime() + serviceDuration * 60 * 1000)
              
              // 过滤出当前时间已经超过服务结束时间的订单
              return now > serviceEndTime
            }
            return false
          } catch (err) {
            console.error(`处理订单 ${order._id} 时出错:`, err)
            return false
          }
        })
        
        console.log(`过滤后剩余 ${allOrders.length} 个已过期的订单`)
      }
    }
    
    return {
      success: true,
      orders: allOrders,
      count: allOrders.length
    }
  } catch (err) {
    console.error('获取订单失败:', err)
    return {
      success: false,
      errMsg: err.message || '查询订单出错'
    }
  }
} 