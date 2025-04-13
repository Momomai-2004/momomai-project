// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { returnCode, resultCode, outTradeNo } = event
  
  // 支付成功
  if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS') {
    const db = cloud.database()
    
    try {
      // 查询充值记录
      const rechargeRes = await db.collection('recharges')
        .where({
          transaction_id: outTradeNo,
          status: 'pending'
        })
        .get()
      
      if (rechargeRes.data.length > 0) {
        const recharge = rechargeRes.data[0]
        
        // 更新充值记录状态
        await db.collection('recharges').doc(recharge._id).update({
          data: {
            status: 'success',
            update_time: db.serverDate()
          }
        })
        
        // 更新用户余额和次数
        if (recharge._openid) {
          const userRes = await db.collection('users')
            .where({
              _openid: recharge._openid
            })
            .get()
          
          if (userRes.data.length > 0) {
            const user = userRes.data[0]
            
            // 更新用户数据
            const updateData = {
              update_time: db.serverDate()
            }
            
            // 如果是金额充值
            if (recharge.amount > 0) {
              updateData.wallet_balance = db.command.inc(recharge.amount)
            }
            
            // 如果是次数充值
            if (recharge.times > 0) {
              updateData.remaining_times = db.command.inc(recharge.times)
            }
            
            await db.collection('users').doc(user._id).update({
              data: updateData
            })
          }
        }
      }
      
      return {
        returnCode: 'SUCCESS',
        returnMsg: 'OK'
      }
    } catch (err) {
      console.error(err)
      return {
        returnCode: 'FAIL',
        returnMsg: err.message
      }
    }
  }
  
  return {
    returnCode: 'SUCCESS',
    returnMsg: 'OK'
  }
}