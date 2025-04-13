// 云函数入口文件
const cloud = require('wx-server-sdk');

// 初始化云环境，不指定环境ID时默认使用第一个环境
// 如果出现问题，可以尝试显式指定环境ID
try {
  cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV,
    traceUser: true // 追踪用户调用信息
  });
  console.log('云环境初始化成功');
} catch (initError) {
  console.error('云环境初始化失败:', initError);
}

const db = cloud.database();
const _ = db.command;
const MAX_LIMIT = 100; // 最大查询数量

// 云函数入口函数
exports.main = async (event, context) => {
  const { staffId, tab = 'today' } = event;
  const wxContext = cloud.getWXContext(); // 获取调用者信息，方便调试
  
  console.log('接收到查询请求，参数:', event, '调用者:', wxContext.OPENID);
  
  if (!staffId) {
    return {
      success: false,
      message: '员工ID不能为空'
    };
  }
  
  try {
    // 安全地检查集合可访问性，使用更简单的方法
    try {
      // 直接获取数量
      const countResult = await db.collection('appointments').count();
      console.log('appointments集合存在，总记录数:', countResult.total);
      
      if (countResult.total === 0) {
        console.log('appointments集合为空');
        return {
          success: true,
          staffId,
          appointments: [],
          total: 0,
          message: 'appointments集合为空'
        };
      }
    } catch (err) {
      console.error('访问appointments集合失败:', err);
      return {
        success: false,
        message: 'appointments集合不存在或无法访问',
        error: err.message || '未知错误'
      };
    }
    
    // 获取当前日期
    const today = formatDate(new Date());
    console.log('今日日期:', today);
    
    // 尝试不同的字段名称，处理数据库中可能的多种命名格式
    const possibleStaffIdFields = ['staffId', 'therapist_id', 'staff_id'];
    let validFieldName = null;
    let staffAppointmentsCount = 0;
    
    // 尝试不同的字段名查询，找到有效的字段名
    for (const fieldName of possibleStaffIdFields) {
      const condition = {};
      condition[fieldName] = staffId;
      
      try {
        const countResult = await db.collection('appointments')
          .where(condition)
          .count();
          
        console.log(`字段 ${fieldName} 查询结果:`, countResult.total);
        
        if (countResult.total > 0) {
          validFieldName = fieldName;
          staffAppointmentsCount = countResult.total;
          console.log(`找到使用 ${fieldName} 字段的员工预约，数量: ${countResult.total}`);
          break;
        }
      } catch (countErr) {
        console.error(`尝试使用 ${fieldName} 字段查询失败:`, countErr);
        // 继续尝试下一个字段名
      }
    }
    
    if (!validFieldName) {
      console.log('未找到该员工的预约记录，尝试的字段名:', possibleStaffIdFields);
      return {
        success: true,
        staffId,
        appointments: [],
        total: 0,
        staffAppointmentsCount: 0,
        allAppointmentsCount: 0,
        message: '未找到该员工的预约记录'
      };
    }
    
    // 构建查询条件
    let query = {};
    query[validFieldName] = staffId;
    
    // 根据标签过滤添加额外条件
    if (tab === 'today') {
      // 今日预约
      query.date = today;
    } else if (tab === 'upcoming') {
      // 未来预约（今日之后7天内）
      const todayDate = new Date();
      const nextWeek = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextWeekStr = formatDate(nextWeek);
      
      try {
        query = _.and([
          query,
          { date: _.gt(today) },
          { date: _.lte(nextWeekStr) }
        ]);
      } catch (andError) {
        console.error('构建复合查询失败:', andError);
        // 退回到简单条件
        query.date = _.gt(today);
      }
    }
    // 'all'选项卡 - 不添加额外条件，查询所有预约，包括已完成的预约
    
    // 获取所有预约数量
    let allAppointmentsCount = 0;
    try {
      const countResult = await db.collection('appointments').count();
      allAppointmentsCount = countResult.total;
    } catch (err) {
      console.error('获取所有预约数量失败:', err);
    }
    
    // 查询预约列表，多加一层错误处理
    let appointments = [];
    try {
      // 查询预约列表
      console.log('执行查询，条件:', JSON.stringify(query));
      const result = await db.collection('appointments')
        .where(query)
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .limit(MAX_LIMIT)
        .get();
      
      appointments = result.data || [];
      console.log(`查询成功，获取到 ${appointments.length} 条预约`);
    } catch (queryError) {
      console.error('查询预约列表失败:', queryError);
      // 尝试更简单的查询作为备用
      try {
        const simpleQuery = {};
        simpleQuery[validFieldName] = staffId;
        
        const backupResult = await db.collection('appointments')
          .where(simpleQuery)
          .limit(MAX_LIMIT)
          .get();
          
        appointments = backupResult.data || [];
        console.log(`备用查询成功，获取到 ${appointments.length} 条预约`);
      } catch (backupError) {
        console.error('备用查询也失败:', backupError);
        // 此时只能返回空数组
      }
    }
    
    return {
      success: true,
      staffId,
      appointments,
      total: appointments.length,
      staffAppointmentsCount,
      allAppointmentsCount,
      validFieldName, // 返回找到的有效字段名，方便调试
      message: '查询成功'
    };
  } catch (error) {
    console.error('查询员工预约失败:', error);
    return {
      success: false,
      message: '查询员工预约失败',
      error: error.message || '未知错误',
      stack: error.stack // 提供更详细的错误信息
    };
  }
};

// 格式化日期为 yyyy-MM-dd
function formatDate(date) {
  try {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('日期格式化失败:', e);
    // 返回今天的日期作为备用
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }
} 