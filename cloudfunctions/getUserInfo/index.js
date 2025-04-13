// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      success: false,
      message: '获取用户信息失败'
    }
  }
  
  try {
    // 从数据库获取用户信息
    const userRes = await db.collection('users')
      .where({
        _openid: openid
      })
      .get()
    
    if (userRes.data.length > 0) {
      return {
        success: true,
        data: userRes.data[0]
      }
    } else {
      return {
        success: false,
        message: '用户不存在'
      }
    }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error
    }
  }
}