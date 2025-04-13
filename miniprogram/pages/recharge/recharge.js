Page({
  data: {
    packages: {
      basic: {
        name: '基础松解拉伸',
        durations: {
          60: {
            4: { price: 1028, average: 257, discount: 0.86 },
            12: { price: 2878, average: 240, discount: 0.8 },
            24: { price: 5258, average: 219, discount: 0.73 }
          },
          90: {
            4: { price: 1518, average: 379, discount: 0.86 },
            12: { price: 4218, average: 352, discount: 0.8 },
            24: { price: 7698, average: 321, discount: 0.73 }
          }
        }
      },
      advanced: {
        // 肌肉筋膜处理套餐配置
      }
    },
    customAmount: '',
    selectedId: '',
    showRenewalDiscount: false,
    packageData: {
      'basic-60-4': { price: 1028, average: 257, sessions: 4, type: 'basic', duration: 60 },
      'basic-60-12': { price: 2878, average: 240, sessions: 12, type: 'basic', duration: 60 },
      'basic-60-24': { price: 5258, average: 219, sessions: 24, type: 'basic', duration: 60 },
      'basic-90-4': { price: 1518, average: 379, sessions: 4, type: 'basic', duration: 90 },
      'basic-90-12': { price: 4228, average: 352, sessions: 12, type: 'basic', duration: 90 },
      'basic-90-24': { price: 7698, average: 321, sessions: 24, type: 'basic', duration: 90 },
      'advanced-60-4': { price: 1378, average: 344, sessions: 4, type: 'advanced', duration: 60 },
      'advanced-60-12': { price: 3838, average: 320, sessions: 12, type: 'advanced', duration: 60 },
      'advanced-60-24': { price: 6998, average: 292, sessions: 24, type: 'advanced', duration: 60 },
      'advanced-90-4': { price: 1998, average: 499, sessions: 4, type: 'advanced', duration: 90 },
      'advanced-90-12': { price: 5568, average: 464, sessions: 12, type: 'advanced', duration: 90 },
      'advanced-90-24': { price: 10148, average: 423, sessions: 24, type: 'advanced', duration: 90 }
    },
    userInfo: null,
    totalAmount: 0,
    selectedPrice: '',
    selectedPackage: null,
    isPackageSelected: false,
    walletBalance: 0
  },

  onLoad() {
    // 确保云环境已初始化
    wx.cloud.init({
      env: 'chilling-4gdawl4ea811c0cd', // 你的云环境ID
      traceUser: true
    });
    
    // 获取用户余额
    this.getUserBalance();
    console.log('充值页面加载');
    this.checkRenewalEligibility();
    this.getUserInfo();
    this.loadPackages();
  },

  // 检查续费优惠资格
  checkRenewalEligibility() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.lastPackage) {
      const { sessions, purchaseDate } = userInfo.lastPackage;
      const now = new Date();
      const purchase = new Date(purchaseDate);
      
      if (sessions === 4 && this.isWithinMonth(purchase, now)) {
        this.setData({ showRenewalDiscount: true });
      } else if (sessions === 12 && this.isWithinQuarter(purchase, now)) {
        this.setData({ showRenewalDiscount: true });
      } else if (sessions === 24 && this.isWithinHalfYear(purchase, now)) {
        this.setData({ showRenewalDiscount: true });
      }
    }
  },

  // 时间判断辅助函数
  isWithinMonth(from, to) {
    return to.getTime() - from.getTime() <= 30 * 24 * 60 * 60 * 1000;
  },

  isWithinQuarter(from, to) {
    return to.getTime() - from.getTime() <= 90 * 24 * 60 * 60 * 1000;
  },

  isWithinHalfYear(from, to) {
    return to.getTime() - from.getTime() <= 180 * 24 * 60 * 60 * 1000;
  },

  // 显示核销选项
  showVerifyOptions() {
    wx.showActionSheet({
      itemList: ['二维码核销', '卡号核销'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.handleQRCodeVerify();
        } else {
          this.handleCardNumberVerify();
        }
      }
    });
  },

  // 输入自定义金额
  onAmountInput(e) {
    this.setData({
      customAmount: e.detail.value,
      selectedId: '',
      totalAmount: Number(e.detail.value) || 0
    });
  },

  // 选择套餐
  selectPackage(e) {
    const id = e.currentTarget.dataset.id;
    const price = e.currentTarget.dataset.price;
    
    this.setData({
      selectedId: id,
      selectedPrice: price,
      isPackageSelected: true
    });
  },

  // 确认选择
  confirmSelection() {
    // 检查操作权限
    const app = getApp();
    if (!app.checkActionPermission('recharge')) {
      wx.showToast({
        title: '您没有充值权限',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.selectedId) {
      wx.showToast({
        title: '请选择充值套餐',
        icon: 'none'
      });
      return;
    }
    
    // 解析套餐ID获取信息
    const id = this.data.selectedId;
    const parts = id.split('_');
    const type = parts[0];  // basic 或 muscle
    const duration = parts[1];  // 60 或 90
    const sessions = parts[2];  // 4, 12 或 24
    
    const typeName = type === 'basic' ? '基础拉伸' : '肌肉筋膜处理';
    const packageName = `${typeName}${duration}分钟${sessions}节`;
    
    wx.showModal({
      title: '确认充值',
      content: `您选择了${packageName}，金额¥${this.data.selectedPrice}`,
      success: res => {
        if (res.confirm) {
          this.processRecharge();
        }
      }
    });
  },

  // 处理充值
  processRecharge() {
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 获取当前用户openid
    const openid = wx.cloud.getWXContext().OPENID;
    
    if (!openid) {
      wx.hideLoading();
      wx.showToast({
        title: '用户信息获取失败',
        icon: 'none'
      });
      return;
    }
    
    // 解析套餐ID获取信息
    const id = this.data.selectedId;
    const parts = id.split('_');
    const type = parts[0];  // basic 或 muscle
    const duration = parts[1];  // 60 或 90
    const sessions = parseInt(parts[2]);  // 4, 12 或 24
    
    const typeName = type === 'basic' ? '基础拉伸' : '肌肉筋膜处理';
    const packageName = `${typeName}${duration}分钟${sessions}节`;
    
    // 模拟微信支付
    setTimeout(() => {
      // 支付成功后更新数据库
      const db = wx.cloud.database();
      
      // 创建充值记录
      db.collection('recharges')
        .add({
          data: {
            package_id: this.data.selectedId,
            package_name: packageName,
            amount: this.data.selectedPrice,
            actual_amount: this.data.selectedPrice,
            times: sessions,
            payment_method: 'wechat',
            transaction_id: 'WX' + new Date().getTime(),
            status: 'success',
            create_time: db.serverDate(),
            update_time: db.serverDate()
          }
        })
        .then(() => {
          // 获取用户信息
          return db.collection('users')
            .where({
              _openid: openid
            })
            .get();
        })
        .then(res => {
          if (res.data.length > 0) {
            const userInfo = res.data[0];
            
            // 更新用户余额和次数
            return db.collection('users')
              .doc(userInfo._id)
              .update({
                data: {
                  remaining_times: userInfo.remaining_times + sessions,
                  update_time: db.serverDate()
                }
              });
          } else {
            return Promise.reject('用户信息不存在');
          }
        })
        .then(() => {
          wx.hideLoading();
          wx.showToast({
            title: '充值成功',
            icon: 'success',
            duration: 2000,
            success: () => {
              setTimeout(() => {
                wx.navigateBack();
              }, 2000);
            }
          });
        })
        .catch(err => {
          wx.hideLoading();
          console.error('充值失败：', err);
          wx.showToast({
            title: '充值失败',
            icon: 'none'
          });
        });
    }, 1500);
  },

  // 获取用户信息
  getUserInfo() {
    wx.request({
      url: 'YOUR_API_ENDPOINT/user/info',
      method: 'GET',
      success: (res) => {
        if (res.data.success) {
          this.setData({
            userInfo: res.data.data
          });
          wx.setStorageSync('userInfo', res.data.data);
        }
      }
    });
  },

  // 处理二维码核销
  handleQRCodeVerify() {
    wx.scanCode({
      success: (res) => {
        // 处理二维码扫描结果
        console.log(res);
      }
    });
  },

  // 处理卡号核销
  handleCardNumberVerify() {
    wx.showModal({
      title: '卡号核销',
      editable: true,
      placeholderText: '请输入卡号',
      success: (res) => {
        if (res.confirm && res.content) {
          // 处理卡号核销
          console.log(res.content);
        }
      }
    });
  },

  // 跳转到核销页面
  goToVerification() {
    wx.navigateTo({
      url: '/pages/verification/verification'
    });
  },

  // 检查页面访问权限
  checkPagePermission() {
    const app = getApp();
    if (!app.checkPagePermission('recharge')) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }
    return true;
  },

  // 加载充值套餐
  loadPackages() {
    // 实现加载充值套餐的逻辑
  },

  // 顶部"立即充值"按钮点击事件
  onRechargeButtonTap() {
    if (!this.data.selectedPackage) {
      wx.showToast({
        title: '请选择充值套餐',
        icon: 'none'
      });
      return;
    }
    this.processPayment();
  },

  // 底部"确认支付"按钮点击事件
  confirmPayment() {
    // 检查是否已选择套餐
    if (!this.data.selectedPackage) {
      wx.showToast({
        title: '请选择充值套餐',
        icon: 'none'
      });
      return;
    }
    
    // 调用支付流程
    this.processPayment();
  },

  // 处理支付逻辑，抽取为公共方法
  processPayment() {
    const selectedPackage = this.data.selectedPackage;
    
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 调用云函数发起支付
    wx.cloud.callFunction({
      name: 'pay',
      data: {
        packageId: selectedPackage.package_id,
        packageName: selectedPackage.name,
        amount: selectedPackage.price,
        type: 'recharge'
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.payment) {
          // 调用微信支付
          wx.requestPayment({
            ...res.result.payment,
            success: () => {
              wx.showToast({
                title: '充值成功',
                icon: 'success'
              });
              
              // 更新用户余额
              this.updateUserBalance(selectedPackage);
              
              // 跳转到会员页面
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            },
            fail: err => {
              console.error('支付失败：', err);
              wx.showToast({
                title: '支付取消',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '发起支付失败',
            icon: 'none'
          });
          console.error('支付参数错误：', res);
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({
          title: '支付失败',
          icon: 'none'
        });
        console.error('调用支付云函数失败：', err);
      }
    });
  },

  // 更新用户余额
  updateUserBalance(selectedPackage) {
    const db = wx.cloud.database();
    
    // 使用云函数获取用户openid
    wx.cloud.callFunction({
      name: 'getuserorder',
      success: res => {
        if (res.result && res.result.openid) {
          const openid = res.result.openid;
          
          // 查询用户信息
          db.collection('users')
            .where({
              _openid: openid
            })
            .get()
            .then(result => {
              if (result.data.length > 0) {
                const userInfo = result.data[0];
                
                // 更新数据库中的用户余额和次数
                return db.collection('users')
                  .doc(userInfo._id)
                  .update({
                    data: {
                      wallet_balance: db.command.inc(selectedPackage.price || 0),
                      remaining_times: db.command.inc(selectedPackage.sessions || 0),
                      update_time: db.serverDate()
                    }
                  });
              } else {
                // 如果用户不存在，创建新用户记录
                return db.collection('users')
                  .add({
                    data: {
                      _openid: openid,
                      wallet_balance: selectedPackage.price || 0,
                      remaining_times: selectedPackage.sessions || 0,
                      create_time: db.serverDate(),
                      update_time: db.serverDate()
                    }
                  });
              }
            })
            .then(() => {
              // 创建充值记录
              return db.collection('recharges')
                .add({
                  data: {
                    _openid: openid,
                    package_id: selectedPackage.package_id,
                    package_name: selectedPackage.name,
                    amount: selectedPackage.price,
                    actual_amount: selectedPackage.price,
                    times: selectedPackage.sessions,
                    payment_method: 'wechat',
                    transaction_id: 'WX' + new Date().getTime(),
                    status: 'success',
                    create_time: db.serverDate(),
                    update_time: db.serverDate()
                  }
                });
            })
            .then(() => {
              console.log('用户余额和充值记录更新成功');
              
              // 更新本地存储的用户信息
              let userInfo = wx.getStorageSync('userInfo') || {};
              userInfo.wallet_balance = (userInfo.wallet_balance || 0) + (selectedPackage.price || 0);
              userInfo.remaining_times = (userInfo.remaining_times || 0) + (selectedPackage.sessions || 0);
              wx.setStorageSync('userInfo', userInfo);
            })
            .catch(err => {
              console.error('更新用户余额失败：', err);
            });
        } else {
          console.error('获取用户openid失败');
        }
      },
      fail: err => {
        console.error('调用云函数失败：', err);
      }
    });
  },

  // 处理金额充值的方法
  handleAmountRecharge() {
    if (!this.data.customAmount || isNaN(this.data.customAmount) || this.data.customAmount <= 0) {
      wx.showToast({
        title: '请输入有效金额',
        icon: 'none'
      });
      return;
    }
    
    const amountInput = Number(this.data.customAmount);
    
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 调用云函数发起支付
    wx.cloud.callFunction({
      name: 'pay',
      data: {
        amount: amountInput,
        type: 'amount'
      },
      success: res => {
        wx.hideLoading();
        if (res.result && res.result.payment) {
          // 调用微信支付
          wx.requestPayment({
            ...res.result.payment,
            success: () => {
              wx.showToast({
                title: '充值成功',
                icon: 'success'
              });
              
              // 更新用户余额
              this.updateWalletBalance(amountInput);
              
              // 返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            },
            fail: err => {
              console.error('支付失败：', err);
              wx.showToast({
                title: '支付取消',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '发起支付失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        wx.showToast({
          title: '支付失败',
          icon: 'none'
        });
        console.error('调用支付云函数失败：', err);
      }
    });
  },

  // 更新钱包余额
  updateWalletBalance(amount) {
    const db = wx.cloud.database();
    
    // 使用云函数获取用户openid
    wx.cloud.callFunction({
      name: 'getuserorder',
      success: res => {
        if (res.result && res.result.openid) {
          const openid = res.result.openid;
          
          // 查询用户信息
          db.collection('users')
            .where({
              _openid: openid
            })
            .get()
            .then(result => {
              if (result.data.length > 0) {
                const userInfo = result.data[0];
                
                // 更新数据库中的用户余额
                return db.collection('users')
                  .doc(userInfo._id)
                  .update({
                    data: {
                      wallet_balance: db.command.inc(Number(amount)),
                      update_time: db.serverDate()
                    }
                  });
              } else {
                // 如果用户不存在，创建新用户记录
                return db.collection('users')
                  .add({
                    data: {
                      _openid: openid,
                      wallet_balance: Number(amount),
                      remaining_times: 0,
                      create_time: db.serverDate(),
                      update_time: db.serverDate()
                    }
                  });
              }
            })
            .then(() => {
              // 创建充值记录
              return db.collection('recharges')
                .add({
                  data: {
                    _openid: openid,
                    amount: Number(amount),
                    actual_amount: Number(amount),
                    payment_method: 'wechat',
                    transaction_id: 'WX' + new Date().getTime(),
                    status: 'success',
                    create_time: db.serverDate(),
                    update_time: db.serverDate()
                  }
                });
            })
            .then(() => {
              console.log('钱包余额和充值记录更新成功');
              
              // 更新本地存储的用户信息
              let userInfo = wx.getStorageSync('userInfo') || {};
              userInfo.wallet_balance = (userInfo.wallet_balance || 0) + Number(amount);
              wx.setStorageSync('userInfo', userInfo);
            })
            .catch(err => {
              console.error('更新钱包余额失败：', err);
            });
        } else {
          console.error('获取用户openid失败');
        }
      },
      fail: err => {
        console.error('调用云函数失败：', err);
      }
    });
  },

  // 添加处理套餐充值的方法
  handlePackageRecharge() {
    if (!this.data.selectedId || !this.data.selectedPrice) {
      wx.showToast({
        title: '请选择充值套餐',
        icon: 'none'
      });
      return;
    }
    
    // 解析套餐ID获取信息
    const id = this.data.selectedId;
    const parts = id.split('_');
    const type = parts[0];  // basic 或 muscle
    const duration = parts[1];  // 60 或 90
    const sessions = parseInt(parts[2]);  // 4, 12 或 24
    
    const typeName = type === 'basic' ? '基础拉伸' : '肌肉筋膜处理';
    const packageName = `${typeName}${duration}分钟${sessions}节`;
    
    // 调用统一的处理方法
    this.processPackagePayment({
      packageId: id,
      packageName: packageName,
      price: this.data.selectedPrice,
      sessions: sessions
    });
  },

  // 处理套餐充值的支付
  processPackagePayment(packageData) {
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    // 调用云函数发起支付
    wx.cloud.callFunction({
      name: 'pay',
      data: {
        packageId: packageData.packageId,
        packageName: packageData.packageName,
        amount: packageData.price,
        sessions: packageData.sessions,
        type: 'package'
      }
    })
    .then(res => {
      wx.hideLoading();
      if (res.result && res.result.payment) {
        // 调用微信支付
        wx.requestPayment({
          ...res.result.payment,
          success: () => {
            wx.showToast({
              title: '充值成功',
              icon: 'success'
            });
            
            // 更新用户余额和次数
            this.updatePackageBalance(packageData);
            
            // 返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          },
          fail: err => {
            console.error('支付失败：', err);
            wx.showToast({
              title: '支付取消',
              icon: 'none'
            });
          }
        });
      } else {
        wx.showToast({
          title: '发起支付失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      wx.showToast({
        title: '支付失败',
        icon: 'none'
      });
      console.error('调用支付云函数失败：', err);
    });
  },

  // 更新套餐余额和次数
  updatePackageBalance(packageData) {
    const db = wx.cloud.database();
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!userInfo || !userInfo._id) return;
    
    // 更新数据库中的用户余额和次数
    db.collection('users')
      .doc(userInfo._id)
      .update({
        data: {
          remaining_times: db.command.inc(packageData.sessions),
          update_time: db.serverDate()
        }
      })
      .then(() => {
        // 更新本地存储的用户信息
        userInfo.remaining_times = (userInfo.remaining_times || 0) + packageData.sessions;
        wx.setStorageSync('userInfo', userInfo);
        
        // 创建充值记录
        this.createRechargeRecord(packageData);
      })
      .catch(err => {
        console.error('更新用户余额失败：', err);
      });
  },

  // 创建充值记录
  createRechargeRecord(packageData) {
    const db = wx.cloud.database();
    
    db.collection('recharges')
      .add({
        data: {
          package_id: packageData.packageId,
          package_name: packageData.packageName,
          amount: packageData.price,
          actual_amount: packageData.price,
          times: packageData.sessions,
          payment_method: 'wechat',
          transaction_id: 'WX' + new Date().getTime(),
          status: 'success',
          create_time: db.serverDate(),
          update_time: db.serverDate()
        }
      })
      .catch(err => {
        console.error('创建充值记录失败：', err);
      });
  },

  // 获取用户余额
  getUserBalance() {
    // 1. 尝试从缓存获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.wallet_balance !== undefined) {
      this.setData({
        walletBalance: userInfo.wallet_balance
      });
      return;
    }
    
    // 2. 如果缓存中没有，则从数据库获取
    const db = wx.cloud.database();
    
    // 调用云函数获取用户信息
    wx.cloud.callFunction({
      name: 'getUserInfo', // 需要创建这个云函数
      data: {},
      success: res => {
        if (res.result && res.result.success) {
          const userData = res.result.data;
          this.setData({
            walletBalance: userData.wallet_balance || 0
          });
        }
      },
      fail: err => {
        console.error('获取用户信息失败：', err);
      }
    });
  }
}); 