Page({
  data: {
    historyList: [],
    loading: false,
    pageSize: 10,
    currentPage: 0,
    hasMore: true
  },

  onLoad: function() {
    // 初始化云开发
    wx.cloud.init({
      env: 'chilling-4gdawl4ea811c0cd', // 替换为你的环境ID
      traceUser: true // 是否在将用户访问记录到用户管理中，在控制台可见
    });
    this.loadHistory();
  },

  onShow() {
    console.log('历史记录页面显示');
    // 重置数据并重新加载
    this.setData({
      historyList: [],
      currentPage: 0,
      hasMore: true
    }, () => {
      this.loadHistory();
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('触发下拉刷新');
    this.setData({
      historyList: [],
      currentPage: 0,
      hasMore: true
    }, () => {
      this.loadHistory(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  // 上拉加载更多
  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadHistory();
    }
  },

  // 加载历史记录
  loadHistory(callback) {
    if (!this.data.hasMore || this.data.loading) {
      if (callback) callback();
      return;
    }
    
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });
    
    // 使用云函数获取用户openid
    wx.cloud.callFunction({
      name: 'getuserorder',
      success: res => {
        console.log('获取用户openid成功：', res.result);
        if (res.result && res.result.openid) {
          let openid = res.result.openid;
          // 获取到openid后查询历史订单
          this.getHistoryFromDB(openid, callback);
        } else {
          wx.hideLoading();
          console.error('获取用户openid失败');
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
          this.setData({ loading: false });
          if (callback) callback();
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败：', err);
        wx.showToast({
          title: '获取历史记录失败',
          icon: 'none'
        });
        this.setData({ loading: false });
        if (callback) callback();
      }
    });
  },
  
  // 从数据库获取历史记录
  getHistoryFromDB(openid, callback) {
    // 构建查询条件 - 只查询completed状态的订单
    const queryCondition = {
      _openid: openid,
      status: 'completed' // 只获取已完成的订单
    };
    
    console.log('历史记录查询条件:', JSON.stringify(queryCondition));
    
    // 直接查询appointments集合
    this.queryCompletedOrders('appointments', queryCondition, (success, orders) => {
      if (success && orders.length > 0) {
        // 成功查到数据
        console.log('从appointments集合成功获取历史订单');
        this.processHistoryOrders(orders, callback);
      } else {
        // 尝试查询orders集合
        console.log('appointments集合未找到完成订单，尝试orders集合');
        this.queryCompletedOrders('orders', queryCondition, (success2, orders2) => {
          if (success2 && orders2.length > 0) {
            console.log('从orders集合成功获取历史订单');
            this.processHistoryOrders(orders2, callback);
          } else {
            // 尝试查询bookings集合
            console.log('orders集合未找到完成订单，尝试bookings集合');
            this.queryCompletedOrders('bookings', queryCondition, (success3, orders3) => {
              if (success3 && orders3.length > 0) {
                console.log('从bookings集合成功获取历史订单');
                this.processHistoryOrders(orders3, callback);
              } else {
                // 所有集合都查询完毕，仍未找到历史订单
                console.warn('所有集合都查询完毕，未找到历史订单数据');
                wx.hideLoading();
                wx.showToast({
                  title: '暂无已完成订单',
                  icon: 'none',
                  duration: 2000
                });
                this.setData({
                  loading: false,
                  historyList: []
                });
                if (callback) callback();
              }
            });
          }
        });
      }
    });
  },

  // 直接查询单个集合的完成订单
  queryCompletedOrders(collectionName, queryCondition, callback) {
    console.log(`直接查询${collectionName}集合的完成订单:`, JSON.stringify(queryCondition));
    
    const db = wx.cloud.database();
    
    db.collection(collectionName)
      .where(queryCondition)
      .orderBy('create_time', 'desc')
      .skip(this.data.currentPage * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        const orders = res.data || [];
        console.log(`${collectionName}集合查询结果: ${orders.length}条数据`);
        
        if (orders.length > 0) {
          callback(true, orders);
        } else {
          callback(false, []);
        }
      })
      .catch(err => {
        console.error(`查询${collectionName}集合失败:`, err);
        callback(false, []);
      });
  },

  // 处理历史订单数据
  processHistoryOrders(orders, callback) {
    // 格式化历史记录数据
    const formattedHistory = orders.map(order => {
      return {
        ...order,
        createTimeFormat: this.formatDate(order.create_time),
        amountFormat: (order.price || 0).toFixed(2),
        statusText: this.getStatusText(order.status),
        paymentMethodText: this.getPaymentMethodText(order.payment_method)
      };
    });
    
    // 更新UI
    this.setData({
      historyList: this.data.currentPage === 0 ? formattedHistory : [...this.data.historyList, ...formattedHistory],
      currentPage: this.data.currentPage + 1,
      hasMore: orders.length === this.data.pageSize,
      loading: false
    });
    
    wx.hideLoading();
    
    if (callback) callback();
  },

  // 获取支付方式文本
  getPaymentMethodText(method) {
    const methodMap = {
      'wechat': '微信支付',
      'wallet': '钱包余额',
      'times': '次数抵扣'
    };
    return methodMap[method] || method;
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'completed': '已完成',
      'cancelled': '已取消',
      'paid': '已支付',
      'pending': '待支付'
    };
    return statusMap[status] || status;
  },

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  // 格式化日期时间
  formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    const date = new Date(dateTimeStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    
    // 找到当前订单
    const order = this.data.historyList.find(item => item._id === orderId);
    if (order) {
      const content = `服务：${order.service_name}\n时长：${order.service_duration}分钟\n预约时间：${order.appointment_date} ${order.time_slot}\n价格：￥${order.amountFormat}\n支付方式：${this.getPaymentMethodText(order.payment_method)}\n状态：${order.statusText}`;
      
      wx.showModal({
        title: '订单详情',
        content: content,
        showCancel: false
      });
    }
  },

  // 去评价
  gotoReview(e) {
    // 阻止冒泡，避免触发父元素的点击事件
    e.stopPropagation();
    
    const orderId = e.currentTarget.dataset.id;
    
    // 找到当前订单
    const order = this.data.historyList.find(item => item._id === orderId);
    if (order) {
      wx.showToast({
        title: '评价功能开发中',
        icon: 'none'
      });
      
      // TODO: 跳转到评价页面
      // wx.navigateTo({
      //   url: `/pages/review/review?id=${orderId}`,
      // });
    }
  },
}); 