// 云函数：createRechargeOrder
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, packageType, customAmount } = event
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取套餐信息
    let amount = 0
    let times = 0
    let discount = 1.0
    let serviceType = ''
    
    if (customAmount) {
      // 自定义金额充值
      amount = customAmount
      times = 0
    } else {
      // 套餐充值
      const packageInfo = getPackageInfo(packageType)
      amount = packageInfo.amount
      times = packageInfo.times
      discount = packageInfo.discount
      serviceType = packageInfo.serviceType
    }
    
    // 创建充值订单
    const result = await db.collection('recharge_records').add({
      data: {
        user_id: userId,
        openid: wxContext.OPENID,
        amount,
        package_type: packageType,
        service_type: serviceType,
        times,
        discount,
        payment_method: 'wechat',
        status: 'pending',
        create_time: db.serverDate()
      }
    })
    
    // 这里应该调用微信支付接口，生成支付参数
    // 由于涉及到商户号等敏感信息，此处省略
    
    return {
      success: true,
      orderId: result._id,
      amount
    }
  } catch (error) {
    return { success: false, error }
  }
}

// 获取套餐信息
function getPackageInfo(packageType) {
  const packages = {
    'basic_60_4': { serviceType: 'basic_60', times: 4, amount: 1028, discount: 0.86 },
    'basic_60_12': { serviceType: 'basic_60', times: 12, amount: 2878, discount: 0.8 },
    'basic_60_24': { serviceType: 'basic_60', times: 24, amount: 5258, discount: 0.73 },
    'basic_90_4': { serviceType: 'basic_90', times: 4, amount: 1518, discount: 0.86 },
    'basic_90_12': { serviceType: 'basic_90', times: 12, amount: 2878, discount: 0.8 },
    'basic_90_24': { serviceType: 'basic_90', times: 24, amount: 5258, discount: 0.73 },
    'advanced_60_4': { serviceType: 'advanced_60', times: 4, amount: 1378, discount: 0.86 },
    'advanced_60_12': { serviceType: 'advanced_60', times: 12, amount: 3838, discount: 0.8 },
    'advanced_60_24': { serviceType: 'advanced_60', times: 24, amount: 6998, discount: 0.73 },
    'advanced_90_4': { serviceType: 'advanced_90', times: 4, amount: 1998, discount: 0.86 },
    'advanced_90_12': { serviceType: 'advanced_90', times: 12, amount: 5568, discount: 0.8 },
    'advanced_90_24': { serviceType: 'advanced_90', times: 24, amount: 10148, discount: 0.73 }
  }
  
  return packages[packageType] || { serviceType: '', times: 0, amount: 0, discount: 1.0 }
}