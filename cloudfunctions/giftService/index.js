// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 计算总次数的函数
function calculateTotalTimes(serviceTimes) {
  return (
    (serviceTimes.basic_60 || 0) +
    (serviceTimes.basic_90 || 0) +
    (serviceTimes.advanced_60 || 0) +
    (serviceTimes.advanced_90 || 0)
  );
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { userId, serviceType, duration, giftTimes, reason, staffInfo } = event
  
  if (!userId || !serviceType || !duration || !giftTimes || !staffInfo) {
    return {
      success: false,
      message: '参数不完整'
    }
  }
  
  try {
    // 检查员工信息
    const staffCheck = await db.collection('users').doc(staffInfo._id).get()
    if (!staffCheck.data || !staffCheck.data.is_staff) {
      return {
        success: false,
        message: '无权限，仅员工可赠送服务'
      }
    }
    
    // 获取会员信息
    const userInfo = await db.collection('users').doc(userId).get()
    if (!userInfo.data) {
      return {
        success: false,
        message: '会员信息不存在'
      }
    }
    
    // 获取服务价格
    const price = getServicePrice(serviceType, duration)
    const totalValue = price * giftTimes
    
    // 准备赠送记录
    const giftRecord = {
      user_id: userId,
      user_phone: userInfo.data.phone,
      user_name: userInfo.data.nickName || userInfo.data.phone,
      gift_times: giftTimes,
      service_type: serviceType,
      service_name: serviceType === 'basic' ? '基础拉伸' : '肌肉筋膜处理/运动训练',
      duration: duration,
      price: price,
      total_value: totalValue,
      reason: reason || '',
      staff_id: staffInfo._id,
      staff_name: staffInfo.name,
      gift_date: db.serverDate(),
    }
    
    // 1. 添加赠送记录
    const giftResult = await db.collection('gift_records').add({
      data: giftRecord
    })
    
    // 2. 更新用户服务次数
    // 如果没有service_times字段，则初始化
    let serviceTimes = userInfo.data.service_times || {
      basic_60: 0,
      basic_90: 0,
      advanced_60: 0,
      advanced_90: 0
    }
    
    // 根据所选服务类型和时长，更新对应的次数
    const serviceTypeKey = serviceType === 'basic' ? 'basic_' : 'advanced_'
    const durationKey = serviceTypeKey + duration
    
    // 更新特定服务类型的次数
    serviceTimes[durationKey] = (serviceTimes[durationKey] || 0) + giftTimes
    
    // 计算新的总次数
    const totalTimes = calculateTotalTimes(serviceTimes)
    
    // 更新会员信息
    await db.collection('users').doc(userId).update({
      data: {
        service_times: serviceTimes,
        remaining_times: totalTimes
      }
    })
    
    return {
      success: true,
      message: '赠送成功',
      giftRecord: giftRecord,
      recordId: giftResult._id
    }
  } catch (error) {
    console.error('赠送服务失败:', error)
    return {
      success: false,
      message: error.message || '赠送失败',
      error
    }
  }
}

// 获取服务价格
function getServicePrice(serviceType, duration) {
  if (serviceType === 'basic') {
    return duration === 60 ? 299 : 439
  } else { // advanced
    return duration === 60 ? 399 : 579
  }
}