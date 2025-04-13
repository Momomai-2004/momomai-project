// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { appointmentId, status, reason, autoComplete } = event
  
  try {
    if (!appointmentId || !status) {
      return {
        success: false,
        errMsg: '参数不完整'
      }
    }
    
    // 获取预约信息
    const appointmentResult = await db.collection('appointments').doc(appointmentId).get()
    const appointment = appointmentResult.data
    
    // 权限检查 - 普通更新只能操作自己的预约，但自动完成允许系统调用
    if (!autoComplete && appointment._openid !== wxContext.OPENID) {
      return {
        success: false,
        errMsg: '没有权限更新此预约'
      }
    }
    
    // 准备更新数据
    const updateData = {
      status: status
    }
    
    // 根据不同状态添加不同字段
    if (status === 'paid') {
      updateData.pay_time = db.serverDate()
    } else if (status === 'cancelled') {
      updateData.cancel_time = db.serverDate()
      if (reason) {
        updateData.cancel_reason = reason
      }
    } else if (status === 'completed') {
      updateData.complete_time = db.serverDate()
      if (autoComplete) {
        updateData.auto_completed = true
      }
    }
    
    // 更新预约状态
    await db.collection('appointments').doc(appointmentId).update({
      data: updateData
    })
    
    return {
      success: true,
      message: '预约状态已更新',
      status: status
    }
  } catch (err) {
    console.error('更新预约状态失败:', err)
    return {
      success: false,
      errMsg: err.message || '更新失败'
    }
  }
} 