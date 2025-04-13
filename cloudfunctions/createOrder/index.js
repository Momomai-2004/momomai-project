const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const orders = db.collection('orders');
const users = db.collection('users');
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    const { 
      serviceName, 
      serviceType, 
      duration, 
      appointmentTime, 
      amount, 
      paymentMethod, 
      contactName, 
      contactPhone, 
      therapistId, 
      therapistName 
    } = event;
    
    // 生成订单编号
    const date = new Date();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `O${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}${random}`;
    
    // 生成核销码
    const verificationCode = Math.random().toString().slice(-6);
    
    // 创建订单
    const orderResult = await orders.add({
      data: {
        _openid: openid,
        orderNumber,
        status: 'pending',
        serviceName,
        serviceType,
        duration,
        appointmentTime,
        appointmentDate: new Date(appointmentTime),
        amount,
        createTime: db.serverDate(),
        paymentMethod,
        contactName,
        contactPhone,
        therapistId,
        therapistName,
        verificationCode,
        isVerified: false
      }
    });
    
    return {
      success: true,
      orderId: orderResult._id,
      orderNumber
    };
    
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: '创建订单失败',
      error: err
    };
  }
};