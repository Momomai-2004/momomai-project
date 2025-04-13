const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { userId, fieldName, amount } = event;
  
  if (!userId || !fieldName || amount === undefined) {
    return {
      success: false,
      message: '参数不完整'
    };
  }

  try {
    // 获取用户信息
    const userResult = await db.collection('users').doc(userId).get();
    const userInfo = userResult.data;
    
    // 判断是否使用新格式数据
    const isNewFormat = !!userInfo.service_times;
    
    // 构建更新数据对象
    let updateData = {};
    
    if (isNewFormat) {
      // 新格式 - 使用service_times对象
      let serviceTypeKey = '';
      
      if (fieldName === 'basic60Count') {
        serviceTypeKey = 'basic_60';
      } else if (fieldName === 'basic90Count') {
        serviceTypeKey = 'basic_90';
      } else if (fieldName === 'advanced60Count') {
        serviceTypeKey = 'advanced_60';
      } else if (fieldName === 'advanced90Count') {
        serviceTypeKey = 'advanced_90';
      }
      
      updateData[`service_times.${serviceTypeKey}`] = db.command.inc(amount);
    } else {
      // 旧格式 - 直接更新字段
      updateData[fieldName] = db.command.inc(amount);
      // 同时更新总次数
      updateData.remaining_times = db.command.inc(amount);
    }
    
    // 更新用户信息
    await db.collection('users').doc(userId).update({
      data: updateData
    });
    
    return {
      success: true,
      message: '更新成功'
    };
  } catch (err) {
    console.error('更新用户服务次数失败：', err);
    return {
      success: false,
      message: err.message || '更新失败'
    };
  }
}; 