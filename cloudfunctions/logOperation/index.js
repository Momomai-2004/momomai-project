// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  console.log('收到日志记录请求:', event)
  
  try {
    const db = cloud.database()
    const result = await db.collection('operation_logs').add({
      data: {
        operation: event.operation || 'unknown',
        target_id: event.target_id || '',
        operator: event.operator || {
          staff_id: '',
          name: '未知'
        },
        details: event.details || {},
        create_time: db.serverDate(),
        openid: wxContext.OPENID
      }
    })
    
    return {
      success: true,
      message: '日志记录成功',
      _id: result._id
    }
  } catch (error) {
    console.error('记录日志失败:', error)
    return {
      success: false,
      message: '日志记录失败',
      error: error.message || error
    }
  }
} 