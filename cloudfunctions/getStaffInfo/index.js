const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV // 使用动态环境配置
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  console.log('收到的参数:', event)
  console.log('当前用户openid:', wxContext.OPENID)

  try {
    // 确保staff集合存在
    try {
      const collections = await db.listCollections().get()
      const hasStaffCollection = collections.data.some(c => c.name === 'staff')
      if (!hasStaffCollection) {
        console.log('staff集合不存在，尝试创建')
        await db.createCollection('staff')
        console.log('staff集合创建成功')
      }
    } catch (err) {
      console.error('检查/创建集合失败:', err)
    }

    // 查询条件
    let staffId = event.staff_id || ''
    
    // 如果未提供员工ID，则查询当前用户的openid
    let query = staffId ? { staff_id: staffId } : { openid: wxContext.OPENID }
    console.log('查询条件:', query)
    
    // 查询员工信息
    const res = await db.collection('staff').where(query).get()
    console.log('查询结果:', res.data)

    // 如果找到了员工信息，直接返回
    if (res.data && res.data.length > 0) {
      console.log('找到员工信息:', res.data[0].name)
      return {
        code: 0,
        message: 'success',
        result: {
          ...res.data[0],
          role: res.data[0].role || 'staff'
        }
      }
    }
    
    // 未找到员工信息，检查是否是预设ID，如果是则创建
    if (['A', 'B', 'C'].includes(staffId)) {
      console.log('未找到员工，开始创建预设员工:', staffId)
      
      // 创建员工数据
      const staffData = {
        staff_id: staffId,
        name: staffId === 'A' ? '员工A' : (staffId === 'B' ? '员工B' : '员工C'),
        role: staffId === 'A' ? 'admin' : 'staff',
        password: '1234567890',
        openid: wxContext.OPENID,
        create_time: db.serverDate()
      }
      
      try {
        // 创建员工记录
        console.log('添加员工数据:', staffData)
        const addResult = await db.collection('staff').add({
          data: staffData
        })
        
        console.log('创建员工成功, ID:', addResult._id)
        
        // 返回创建的员工信息
        return {
          code: 0,
          message: 'success',
          result: staffData
        }
      } catch (addErr) {
        console.error('创建员工失败:', addErr)
        return {
          code: -2,
          message: '创建员工记录失败',
          error: addErr
        }
      }
    }
    
    // 如果不是预设ID，返回未找到
    return {
      code: 404,
      message: '员工信息未找到'
    }
  } catch (err) {
    console.error('执行过程中发生错误:', err)
    return {
      code: -1,
      message: '获取员工信息失败',
      error: err.message || err
    }
  }
}