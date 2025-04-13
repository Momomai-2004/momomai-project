// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const openid = wxContext.OPENID
  
  // 获取支付参数
  const { 
    packageId, // 套餐ID
    packageName, // 套餐名称
    amount, // 金额
    sessions, // 次数
    type, // 类型：recharge(充值), package(套餐), amount(金额), appointment(预约)
    appointmentInfo // 预约信息
  } = event
  
  try {
    // 生成随机订单号
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
    
    // 构建订单数据
    const orderData = {
      _openid: openid,
      order_id: orderId,
      amount: Number(amount),
      status: 'pending', // 待支付
      create_time: db.serverDate(),
      update_time: db.serverDate(),
      type: type,
    }
    
    // 根据不同类型添加不同的字段
    if (type === 'recharge' || type === 'package') {
      orderData.package_id = packageId
      orderData.package_name = packageName
      orderData.sessions = Number(sessions) || 0
    } else if (type === 'appointment') {
      orderData.appointment_info = appointmentInfo || {}
    }
    
    // 创建订单记录
    await db.collection('orders').add({
      data: orderData
    })
    
    // 设置支付主体内容
    let body = '支付'
    if (type === 'recharge') body = '账户充值'
    else if (type === 'package') body = `套餐：${packageName}`
    else if (type === 'amount') body = '金额充值'
    else if (type === 'appointment') body = `预约：${appointmentInfo?.service_name || '服务'}`
    
    // 调用微信支付API
    const res = await cloud.cloudPay.unifiedOrder({
      body: body,
      outTradeNo: orderId,
      spbillCreateIp: '127.0.0.1',
      subMchId: '1900000109', // 需要替换为你的微信支付商户号
      totalFee: Math.round(amount * 100), // 单位：分
      envId: cloud.DYNAMIC_CURRENT_ENV,
      functionName: 'pay_callback', // 支付结果通知的云函数
    })
    
    // 日志记录
    console.log('统一下单返回:', res)
    
    // 返回支付参数给前端
    return {
      success: true,
      payment: res.payment,
      order_id: orderId
    }
  } catch (error) {
    console.error('支付失败:', error)
    return {
      success: false,
      error: error.message || error
    }
  }
}