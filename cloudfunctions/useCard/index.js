// 云函数：useCard
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { cardNo, userId } = event
  const wxContext = cloud.getWXContext()
  
  // 开始数据库事务
  const transaction = await db.startTransaction()
  
  try {
    // 查询卡券
    const cardRes = await transaction.collection('cards').where({
      card_no: cardNo,
      is_used: false
    }).get()
    
    if (cardRes.data.length === 0) {
      await transaction.rollback()
      return { success: false, message: '无效的卡券或已被使用' }
    }
    
    const card = cardRes.data[0]
    
    // 获取服务类型和次数
    const { service_type, times } = card
    
    // 更新卡券状态
    await transaction.collection('cards').doc(card._id).update({
      data: {
        is_used: true,
        used_by: userId,
        used_time: db.serverDate()
      }
    })
    
    // 更新用户次数
    const userRes = await transaction.collection('users').doc(userId).get()
    const user = userRes.data
    
    // 确保service_times字段存在
    if (!user.service_times) {
      user.service_times = {
        basic_60: 0,
        basic_90: 0,
        advanced_60: 0,
        advanced_90: 0
      }
    }
    
    // 创建更新对象
    const updateData = {
      update_time: db.serverDate()
    }
    
    // 增加次数
    updateData[`service_times.${service_type}`] = db.command.inc(times)
    
    // 更新总次数
    updateData.remaining_times = db.command.inc(times)
    
    // 更新用户数据
    await transaction.collection('users').doc(userId).update({
      data: updateData
    })
    
    // 提交事务
    await transaction.commit()
    
    return { 
      success: true, 
      message: '卡券核销成功',
      addedTimes: times,
      serviceType: service_type
    }
  } catch (error) {
    await transaction.rollback()
    return { success: false, error }
  }
}