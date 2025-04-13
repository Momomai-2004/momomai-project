// 云函数：payAppointment
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { appointmentId, paymentMethod } = event
  
  try {
    // 获取预约信息
    const appointmentRes = await db.collection('appointments').doc(appointmentId).get()
    const appointment = appointmentRes.data
    
    if (!appointment) {
      return { success: false, message: '预约不存在' }
    }
    
    // 获取用户信息
    const userRes = await db.collection('users').doc(appointment.user_id).get()
    const user = userRes.data
    
    if (!user) {
      return { success: false, message: '用户不存在' }
    }
    
    // 根据支付方式处理
    if (paymentMethod === 'balance') {
      // 检查余额是否足够
      if (user.balance < appointment.price) {
        return { success: false, message: '余额不足' }
      }
      
      // 扣除余额
      await db.collection('users').doc(user._id).update({
        data: {
          balance: db.command.inc(-appointment.price),
          update_time: db.serverDate()
        }
      })
    } else if (paymentMethod === 'times') {
      // 检查次数是否足够
      const serviceField = getServiceField(appointment.service_type)
      if (!user.service_times || user.service_times[serviceField] < 1) {
        return { success: false, message: '次数不足' }
      }
      
      // 创建更新对象
      const updateData = {
        update_time: db.serverDate()
      }
      
      // 扣除次数
      updateData[`service_times.${serviceField}`] = db.command.inc(-1)
      
      // 更新总次数
      updateData.remaining_times = db.command.inc(-1)
      
      // 更新用户数据
      await db.collection('users').doc(user._id).update({
        data: updateData
      })
    }
    
    // 更新预约支付状态
    await db.collection('appointments').doc(appointmentId).update({
      data: {
        payment_method: paymentMethod,
        payment_status: 'paid',
        payment_time: db.serverDate()
      }
    })
    
    return { success: true, message: '支付成功' }
  } catch (error) {
    return { success: false, error }
  }
}

// 获取服务类型对应的字段名
function getServiceField(serviceType) {
  switch (serviceType) {
    case 'basic_60': return 'basic_60';
    case 'basic_90': return 'basic_90';
    case 'advanced_60': return 'advanced_60';
    case 'advanced_90': return 'advanced_90';
    default: return '';
  }
}