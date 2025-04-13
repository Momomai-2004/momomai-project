// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  const openid = wxContext.OPENID
  
  try {
    // 获取治疗师数据（如果需要的话）
    const therapistsResult = await db.collection('therapists').get()
    const therapists = therapistsResult.data || []
    
    // 这里可以根据需要添加其他查询，例如查询用户信息等
    // 示例：用户基本信息查询
    // const userInfo = await db.collection('users').where({
    //   _openid: openid
    // }).get()
    
    return {
      success: true,
      openid: openid,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      data: therapists, // 前端代码中有使用 therapists: res.result.data
      // 如果有其他数据也可以一并返回
      // userInfo: userInfo.data[0] || {}
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      success: false,
      openid: openid,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
      error: error
    }
  }
}