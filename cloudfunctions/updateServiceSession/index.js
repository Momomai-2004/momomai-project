// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { userId, field, amount } = event
  
  if (!userId || !field || amount === undefined) {
    return {
      success: false,
      errMsg: '参数不完整'
    }
  }
  
  try {
    const user = await db.collection('users').doc(userId).get()
    const userData = user.data
    
    // 判断是新格式还是旧格式
    const isNewFormat = !!userData.service_times
    
    // 构建更新对象
    const updateData = {}
    
    if (isNewFormat) {
      // 新格式: 使用service_times对象
      let serviceKey = ''
      if (field === 'basic60Count') serviceKey = 'basic_60'
      else if (field === 'basic90Count') serviceKey = 'basic_90'
      else if (field === 'advanced60Count') serviceKey = 'advanced_60'
      else if (field === 'advanced90Count') serviceKey = 'advanced_90'
      
      if (serviceKey) {
        updateData[`service_times.${serviceKey}`] = db.command.inc(amount)
      }
    } else {
      // 旧格式: 直接更新字段
      updateData[field] = db.command.inc(amount)
      updateData.remaining_times = db.command.inc(amount)
    }
    
    // 执行更新
    await db.collection('users').doc(userId).update({
      data: updateData
    })
    
    return {
      success: true,
      updated: updateData
    }
  } catch (error) {
    return {
      success: false,
      errMsg: error.message,
      error: error
    }
  }
} 