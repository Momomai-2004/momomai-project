// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { appointment, userInfo } = event
  
  if (!appointment || !userInfo) {
    return {
      success: false,
      errMsg: '参数不完整'
    }
  }
  
  // 添加openid
  appointment._openid = wxContext.OPENID
  
  try {
    // 获取最新的用户信息
    const userResult = await db.collection('users').doc(userInfo._id).get()
    const latestUser = userResult.data
    
    // 确保therapist_id字段存在
    if (!appointment.therapist_id) {
      // 如果没有指定理疗师，获取一个可用的理疗师
      const therapistsResult = await db.collection('therapists')
        .where({ status: 'active' })
        .limit(1)
        .get();
      
      if (therapistsResult.data && therapistsResult.data.length > 0) {
        appointment.therapist_id = therapistsResult.data[0]._id;
        console.log('自动分配理疗师:', therapistsResult.data[0].name, therapistsResult.data[0]._id);
      } else {
        return {
          success: false,
          errMsg: '无法分配理疗师，请稍后再试'
        };
      }
    }
    
    // 确保staff_id与therapist_id同步
    appointment.staff_id = appointment.therapist_id;
    
    // 检查支付方式是否有效
    if (appointment.payment_method === 'wallet' && 
        latestUser.wallet_balance < appointment.price) {
      return {
        success: false,
        errMsg: '钱包余额不足'
      }
    }
    
    if (appointment.payment_method === 'times') {
      // 获取服务类型和时长
      const serviceType = appointment.service_category
      const serviceDuration = appointment.service_duration
      
      // 判断新旧格式
      const isNewFormat = !!latestUser.service_times
      
      // 检查可用次数
      let availableCount = 0
      
      if (isNewFormat) {
        // 新格式
        if (serviceType === 'basic' && serviceDuration === 60) {
          availableCount = latestUser.service_times.basic_60 || 0
        } else if (serviceType === 'basic' && serviceDuration === 90) {
          availableCount = latestUser.service_times.basic_90 || 0
        } else if (serviceType === 'advanced' && serviceDuration === 60) {
          availableCount = latestUser.service_times.advanced_60 || 0
        } else if (serviceType === 'advanced' && serviceDuration === 90) {
          availableCount = latestUser.service_times.advanced_90 || 0
        }
      } else {
        // 旧格式
        if (serviceType === 'basic' && serviceDuration === 60) {
          availableCount = latestUser.basic60Count || 0
        } else if (serviceType === 'basic' && serviceDuration === 90) {
          availableCount = latestUser.basic90Count || 0
        } else if (serviceType === 'advanced' && serviceDuration === 60) {
          availableCount = latestUser.advanced60Count || 0
        } else if (serviceType === 'advanced' && serviceDuration === 90) {
          availableCount = latestUser.advanced90Count || 0
        }
      }
      
      if (availableCount <= 0) {
        return {
          success: false,
          errMsg: '该服务剩余次数不足'
        }
      }
    }
    
    // 添加创建时间
    appointment.create_time = db.serverDate()
    
    // 为钱包或次数支付方式设置状态为已支付，微信支付保持为待支付
    if (appointment.payment_method === 'wallet' || appointment.payment_method === 'times') {
      appointment.status = 'paid'
      appointment.pay_time = db.serverDate()
    } else {
      appointment.status = appointment.status || 'pending'
    }
    
    console.log('创建预约记录:', appointment);
    
    // 1. 创建预约记录
    const appointmentResult = await db.collection('appointments').add({
      data: appointment
    })
    
    const appointmentId = appointmentResult._id
    
    // 2. 根据支付方式处理用户余额或次数
    if (appointment.payment_method === 'wallet') {
      // 扣除余额
      await db.collection('users').doc(userInfo._id).update({
        data: {
          wallet_balance: db.command.inc(-appointment.price)
        }
      })
      
      // 创建交易记录
      await db.collection('transactions').add({
        data: {
          _openid: wxContext.OPENID,
          type: 'wallet_payment',
          amount: -appointment.price,
          description: `预约服务: ${appointment.service_name}`,
          related_id: appointmentId,
          balance_after: latestUser.wallet_balance - appointment.price,
          create_time: db.serverDate()
        }
      })
    }
    
    if (appointment.payment_method === 'times') {
      const serviceType = appointment.service_category
      const serviceDuration = appointment.service_duration
      
      // 判断新旧格式
      const isNewFormat = !!latestUser.service_times
      
      // 准备更新数据
      let updateData = {}
      let serviceCountField = ''
      let currentCount = 0
      
      if (isNewFormat) {
        // 新格式
        let serviceKey = ''
        
        if (serviceType === 'basic' && serviceDuration === 60) {
          serviceKey = 'basic_60'
          serviceCountField = 'basic60Count'
          currentCount = latestUser.service_times.basic_60 || 0
        } else if (serviceType === 'basic' && serviceDuration === 90) {
          serviceKey = 'basic_90'
          serviceCountField = 'basic90Count'
          currentCount = latestUser.service_times.basic_90 || 0
        } else if (serviceType === 'advanced' && serviceDuration === 60) {
          serviceKey = 'advanced_60'
          serviceCountField = 'advanced60Count'
          currentCount = latestUser.service_times.advanced_60 || 0
        } else if (serviceType === 'advanced' && serviceDuration === 90) {
          serviceKey = 'advanced_90'
          serviceCountField = 'advanced90Count'
          currentCount = latestUser.service_times.advanced_90 || 0
        }
        
        updateData[`service_times.${serviceKey}`] = db.command.inc(-1)
      } else {
        // 旧格式
        if (serviceType === 'basic' && serviceDuration === 60) {
          serviceCountField = 'basic60Count'
          currentCount = latestUser.basic60Count || 0
        } else if (serviceType === 'basic' && serviceDuration === 90) {
          serviceCountField = 'basic90Count'
          currentCount = latestUser.basic90Count || 0
        } else if (serviceType === 'advanced' && serviceDuration === 60) {
          serviceCountField = 'advanced60Count'
          currentCount = latestUser.advanced60Count || 0
        } else if (serviceType === 'advanced' && serviceDuration === 90) {
          serviceCountField = 'advanced90Count'
          currentCount = latestUser.advanced90Count || 0
        }
        
        updateData[serviceCountField] = db.command.inc(-1)
        updateData.remaining_times = db.command.inc(-1)
      }
      
      // 扣除对应服务的次数
      await db.collection('users').doc(userInfo._id).update({
        data: updateData
      })
      
      // 创建次数使用记录
      await db.collection('transactions').add({
        data: {
          _openid: wxContext.OPENID,
          type: 'times_usage',
          amount: -1,
          service_type: serviceType,
          service_duration: serviceDuration,
          description: `预约服务: ${appointment.service_name}`,
          related_id: appointmentId,
          remaining_after: currentCount - 1,
          create_time: db.serverDate()
        }
      })
    }
    
    // 3. 获取更新后的用户信息
    const updatedUserResult = await db.collection('users').doc(userInfo._id).get()
    
    return {
      success: true,
      appointmentId: appointmentId,
      updatedUser: updatedUserResult.data,
      therapist_id: appointment.therapist_id
    }
  } catch (error) {
    console.error('创建预约失败:', error)
    return {
      success: false,
      errMsg: error.message || '创建预约失败',
      error: error
    }
  }
}