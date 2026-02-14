<template>
  <div class="container">
    <!-- 加载动画 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-tips">初始化中，请稍后...</div>
      </div>
    </div>

    <!-- 公告 -->
    <div class="notice glass">
      <span class="notice-title">大笨养鸡：</span>
      <div class="notice-content-container">
        <span class="notice-content">基金数据由第三方接口【天天基金】提供，如有更新不准，请见谅。（10秒钟更新一次涨跌幅）</span>
      </div>
    </div>

    <div class="fund-form glass">
      <input 
        type="text" 
        v-model="fundCode" 
        placeholder="输入基金代码 (如 110022)"
        @keyup.enter="addFund"
      >
      <button @click="addFund">添加自选基金</button>
    </div>

    <div class="fund-list">
      <div 
        v-for="fund in filteredFunds" 
        :key="fund.code" 
        class="fund-card glass"
      >
        <div class="fund-simple">
          <div class="fund-name">
            <h3>
              <span class="fund-name-text">{{ fund.name }}</span>
            </h3>
            <p>
              {{ fund.code }}
              <el-tag v-if="fund.updated" type="success" size="mini" style="margin-left: 8px;">已更新</el-tag>
            </p>
          </div>
          <div class="fund-estimate">
            <span 
              class="value" 
              :class="getGrowthRateClass(fund.growthRate)"
            >
              {{ formatGrowthRate(fund.growthRate) }}%
            </span>
            <span class="estimate-value">{{ fund.estimateNetWorth }}</span>
          </div>
          <div class="fund-actions">
            <el-button 
              type="danger" 
              size="small" 
              circle 
              @click="removeFund(fund.code)"
            >
              <i class="el-icon-delete"></i>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="filteredFunds.length === 0" class="empty-state glass">
        <p>尚未添加基金</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'
import { hasFunds, storeFunds, getFundByCode } from './utils/indexDB'
import fundData from './static/fundcode_search'

export default {
  name: 'App',
  data() {
    return {
      fundCode: '',
      funds: [],
      settings: {
        refreshInterval: 10
      },
      showStocks: {},
      refreshTimer: null,
      loading: true
    }
  },
  computed: {
    filteredFunds() {
      // 按涨幅从大到小排序
      return JSON.parse(JSON.stringify(this.funds)).sort((a, b) => b.growthRate - a.growthRate)
    }
  },
  async mounted() {
    console.warn("1111")
    // 检查 indexDB 是否已存储基金数据
    const hasData = await hasFunds()
    
    if (!hasData) {
      // 显示 loading，存储基金数据
      this.loading = true
      try {
        await this.initFundData()
        // 存储完成，隐藏 loading
        this.loading = false
        // 从本地存储加载数据
        this.loadFromStorage()
        // 启动自动刷新
        this.startAutoRefresh()
      } catch (error) {
        console.error('初始化基金数据失败:', error)
        // 存储失败，也隐藏 loading 并继续
        this.loading = false
        this.loadFromStorage()
        this.startAutoRefresh()
      }
    } else {
      // 已有数据，直接隐藏 loading 并继续
      this.loading = false
      this.loadFromStorage()
      this.startAutoRefresh()
      
      // 如果本地存储中有基金数据，立即刷新一次获取实时估值
      if (this.funds.length > 0) {
        this.refreshFunds()
      }
    }
  },
  methods: {
    // 初始化基金数据
    async initFundData() {
      try {
        // 使用本地导入的基金数据
        await storeFunds(fundData.r)
      } catch (error) {
        console.error('初始化基金数据失败:', error)
        this.$message.error({
          message: '初始化基金数据失败: ' + error.message + '\n\n请刷新页面重试',
          duration: 6000,
          showClose: true
        })
        throw error
      }
    },
    
    // 从本地存储加载数据
    loadFromStorage() {
      const savedFunds = localStorage.getItem('funds')
      const savedSettings = localStorage.getItem('settings')
      
      if (savedFunds) {
        this.funds = JSON.parse(savedFunds)
      }
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        // 只保留其他设置，refreshInterval 固定为10秒
        this.settings = {
          ...settings,
          refreshInterval: 10
        }
      }
    },
    
    // 保存数据到本地存储
    saveToStorage() {
      localStorage.setItem('funds', JSON.stringify(this.funds))
      localStorage.setItem('settings', JSON.stringify(this.settings))
    },
    
    // 启动自动刷新
    startAutoRefresh() {
      console.log('========== 启动自动刷新 ==========')
      if (this.refreshTimer) {
        console.log('清除已有定时器')
        clearInterval(this.refreshTimer)
      }
      
      console.log('设置定时器，间隔:', this.settings.refreshInterval, '秒')
      this.refreshTimer = setInterval(() => {
        console.log('定时器触发，执行刷新')
        this.refreshFunds()
      }, this.settings.refreshInterval * 1000)
      console.log('========== 自动刷新已启动 ==========')
    },
    
    // 添加基金
    async addFund() {
      if (!this.fundCode) return
      
      // 检查基金是否已存在
      if (this.funds.some(fund => fund.code === this.fundCode)) {
        this.$message.warning('该基金已添加')
        return
      }
      
      try {
        // 检查基金是否存在于 indexDB 中
        const fundInfo = await getFundByCode(this.fundCode)
        
        if (!fundInfo) {
          this.$message.warning('暂无此基金')
          return
        }
        
        // 创建新基金对象，只保存基金代码，名称将在刷新时从接口获取
        const newFund = {
          code: this.fundCode,
          name: '', // 初始为空，刷新时从接口获取
          netWorth: '1.0000',
          estimateNetWorth: '1.0000',
          growthRate: 0,
          isFavorite: true,
          updated: false, // 初始化为false
          stocks: []
        }
        
        this.funds.push(newFund)
        this.fundCode = ''
        this.saveToStorage()
        
        // 添加基金后刷新所有基金的实时估值
        this.refreshFunds()
      } catch (error) {
        console.error('添加基金失败:', error)
        this.$message.error('添加基金失败，请稍后重试')
      }
    },
    
    // 获取基金实时估值数据
    fetchFundData(code) {
      console.log('开始获取基金数据:', code)
      return new Promise((resolve, reject) => {
        try {
          // 保存原始的 jsonpgz 函数（如果存在）
          const originalJsonpgz = window.jsonpgz
          let timeoutId = null
          let resolved = false
          
          // 定义全局回调函数
          window.jsonpgz = function(data) {
            console.log('收到基金数据:', code, data)
            // 检查是否已经resolve过，避免重复
            if (resolved) return
            resolved = true
            
            // 清除超时定时器
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            // 处理返回的数据
            const result = {
              name: data.name, // 从实时估值API获取基金名称
              netWorth: data.dwjz,
              estimateNetWorth: data.gsz,
              growthRate: parseFloat(data.gszzl)
            }
            resolve(result)
            
            // 清理
            if (originalJsonpgz) {
              window.jsonpgz = originalJsonpgz
            } else {
              delete window.jsonpgz
            }
            
            // 移除脚本
            try {
              document.body.removeChild(script)
            } catch (e) {
              // 忽略移除失败的错误
            }
          }
          
          // 创建脚本元素
          const script = document.createElement('script')
          
          // 设置脚本地址，使用原始URL，添加时间戳防止缓存
          const url = `http://fundgz.1234567.com.cn/js/${code}.js?_=${Date.now()}`
          console.log('请求基金数据URL:', url)
          script.src = url
          script.type = 'text/javascript'
          script.onerror = function() {
            console.error('获取基金数据失败:', code)
            // 检查是否已经resolve过
            if (resolved) return
            resolved = true
            
            // 清除超时定时器
            if (timeoutId) {
              clearTimeout(timeoutId)
              timeoutId = null
            }
            // 如果失败，返回默认数据
            resolve({
              netWorth: '1.0000',
              estimateNetWorth: '1.0000',
              growthRate: 0
            })
            
            // 清理
            if (originalJsonpgz) {
              window.jsonpgz = originalJsonpgz
            } else {
              delete window.jsonpgz
            }
            
            // 移除脚本
            try {
              document.body.removeChild(script)
            } catch (e) {
              // 忽略移除失败的错误
            }
          }
          
          // 添加到页面
          document.body.appendChild(script)
          console.log('脚本已添加到页面:', code)
          
          // 添加超时处理
          timeoutId = setTimeout(() => {
            console.error('获取基金数据超时:', code)
            // 检查是否已经resolve过
            if (resolved) return
            resolved = true
            
            // 如果超时，返回默认数据
            resolve({
              netWorth: '1.0000',
              estimateNetWorth: '1.0000',
              growthRate: 0
            })
            
            // 清理
            if (originalJsonpgz) {
              window.jsonpgz = originalJsonpgz
            } else {
              delete window.jsonpgz
            }
            
            // 移除脚本
            try {
              document.body.removeChild(script)
            } catch (e) {
              // 忽略移除失败的错误
            }
          }, 5000) // 5秒超时
        } catch (error) {
          console.error('获取基金数据失败:', code, error)
          // 如果获取失败，返回默认数据
          resolve({
            netWorth: '1.0000',
            estimateNetWorth: '1.0000',
            growthRate: 0
          })
        }
      })
    },
    
    // 获取基金历史净值数据（当日涨跌幅）
    async fetchFundHistory(code) {
      try {
        const response = await axios.get('/api/f10/lsjz', {
          params: {
            fundCode: code,
            pageIndex: 1,
            pageSize: 1,
            _: Date.now()
          },
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json, text/plain, */*'
          }
        })
        console.log('获取基金历史数据:', code, response.data)
        return response.data
      } catch (error) {
        console.error('获取基金历史数据失败:', code, error)
        return null
      }
    },
    
    // 删除基金
    removeFund(code) {
      this.$confirm('确定要删除该基金吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'mobile-confirm-dialog',
        center: true
      }).then(() => {
        this.funds = this.funds.filter(fund => fund.code !== code)
        delete this.showStocks[code]
        this.saveToStorage()
        this.$message.success('删除成功')
      }).catch(() => {
        // 用户取消删除
      })
    },
    
    // 切换自选状态
    toggleFavorite(code) {
      this.funds = this.funds.map(fund => 
        fund.code === code ? { ...fund, isFavorite: !fund.isFavorite } : fund
      )
      this.saveToStorage()
    },
    
    // 切换重仓股显示
    toggleStocks(code) {
      this.showStocks = {
        ...this.showStocks,
        [code]: !this.showStocks[code]
      }
    },
    
    // 刷新基金数据
    async refreshFunds() {
      console.log('========== 开始刷新基金数据 ==========')
      try {
        // 判断当前时间是否大于晚上7点半
        const now = new Date()
        const isAfter730PM = now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30)
        
        // 判断是否是工作日（星期一到星期五）
        const dayOfWeek = now.getDay()
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5
        
        console.log('刷新基金数据 - 时间:', now.toLocaleString(), '是否工作日:', isWeekday, '是否大于7点半:', isAfter730PM)
        console.log('基金列表长度:', this.funds.length)
        console.log('基金列表:', this.funds)
        
        // 使用for循环而不是Promise.all，确保请求按顺序执行，避免数据错乱
        for (let i = 0; i < this.funds.length; i++) {
          const fund = this.funds[i]
          
          console.log('处理基金:', fund.code, fund.name, '已更新:', fund.updated)
          
          // 如果基金已更新，则跳过
          if (fund.updated) {
            console.log('基金已更新，跳过:', fund.code)
            continue
          }
          
          const fundData = await this.fetchFundData(fund.code)
          
          // 更新基金数据
          this.$set(this.funds, i, {
            ...this.funds[i],
            name: fundData.name || this.funds[i].name,
            netWorth: fundData.netWorth,
            estimateNetWorth: fundData.estimateNetWorth,
            growthRate: fundData.growthRate
          })
          
          // 如果是周末直接请求，如果是工作日则判断是否大于晚上7点半
          console.log('判断是否请求历史数据 - 是否周末:', !isWeekday, '是否大于7点半:', isAfter730PM, '结果:', !isWeekday || isAfter730PM)
          
          if (!isWeekday || isAfter730PM) {
            // 检查基金是否已更新，如果已更新则跳过历史数据请求
            if (this.funds[i].updated) {
              console.log('基金已更新，跳过历史数据请求:', fund.code)
              continue
            }
            
            console.log('请求历史数据:', fund.code)
            const historyData = await this.fetchFundHistory(fund.code)
            
            console.log('历史数据返回:', fund.code, historyData)
            
            if (historyData && historyData.Data && historyData.Data.LSJZList && historyData.Data.LSJZList.length > 0) {
              const latestData = historyData.Data.LSJZList[0]
              
              // 判断接口返回的数据日期是否符合要求
              const today = now.toISOString().split('T')[0]
              const dataDate = latestData.FSRQ
              
              // 计算周五的日期
              const friday = new Date(now)
              const dayOfWeek = friday.getDay()
              const daysUntilFriday = dayOfWeek === 0 ? -2 : (dayOfWeek === 6 ? -1 : 0)
              friday.setDate(friday.getDate() + daysUntilFriday)
              const fridayDate = friday.toISOString().split('T')[0]
              
              // 判断是否应该更新数据
              let shouldUpdate = false
              if (isWeekday) {
                // 工作日：判断是否是当天
                shouldUpdate = dataDate === today
              } else {
                // 周末：判断是否是周五
                shouldUpdate = dataDate === fridayDate
              }
              
              console.log('日期判断:', fund.code, '数据日期:', dataDate, '目标日期:', isWeekday ? today : fridayDate, '是否更新:', shouldUpdate)
              
              if (shouldUpdate) {
                // 替换实时估值的值为接口返回的当日涨跌幅
                this.$set(this.funds, i, {
                  ...this.funds[i],
                  growthRate: parseFloat(latestData.JZZZL),
                  updated: true
                })
                console.log('基金已更新:', fund.code, '涨跌幅:', latestData.JZZZL, 'updated:', this.funds[i].updated)
              }
            }
          }
        }
        
        // 强制更新视图
        this.$forceUpdate()
        
        // 保存到本地存储
        this.saveToStorage()
        
        console.log('更新后的基金列表:', this.funds)
        console.log('========== 刷新基金数据完成 ==========')
      } catch (error) {
        console.error('刷新基金数据失败:', error)
      }
    },
    
    // 获取涨跌幅样式类
    getGrowthRateClass(rate) {
      if (rate > 0) {
        return 'positive'
      } else if (rate < 0) {
        return 'negative'
      } else {
        return 'zero'
      }
    },
    
    // 格式化涨跌幅
    formatGrowthRate(rate) {
      if (rate > 0) {
        return `+${rate}`
      } else if (rate < 0) {
        return `${rate}`
      } else {
        return '0'
      }
    }
  },
  beforeDestroy() {
    // 清除定时器
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: Arial, sans-serif;
  background: radial-gradient(1200px 600px at 10% -10%, #60a5fa26, transparent 40%), radial-gradient(1000px 500px at 90% 0%, #22d3ee1f, transparent 45%), var(--bg);
  color: #333;
  line-height: 1.6;
}

/* 移动端确认对话框样式 */
.mobile-confirm-dialog {
  width: auto !important;
  max-width: none !important;
  padding: 15px !important;
}

@media (max-width: 768px) {
  .mobile-confirm-dialog {
    width: auto !important;
    max-width: none !important;
    padding: 15px !important;
  }
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px 20px 15px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 玻璃拟态效果 */
.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(200, 200, 200, 0.2);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

/* 基金表单 */
.fund-form {
  padding: 20px;
  margin-bottom: 30px;
  text-align: center;
}

.fund-form input {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border: 1px solid rgba(200, 200, 200, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  font-size: 16px;
}

.fund-form button {
  padding: 12px 30px;
  border: none;
  border-radius: 8px;
  background: #60a5fa;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.fund-form button:hover {
  background: #3b82f6;
}

/* 页面标题 */
.page-title {
  padding: 8px;
  margin-bottom: 20px;
  text-align: center;
}

.page-title h1 {
  margin: 0;
  font-size: 20px;
  color: white;
  font-weight: bold;
  letter-spacing: 2px;
}

/* 公告 */
.notice {
  padding: 2px;
  margin-bottom: 20px;
  text-align: left;
  background: #fefbe0 !important;
  border-left: 4px solid #ffc107;
  border-radius: 8px;
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
}

.notice-title {
  font-size: 13px;
  color: #ff7b35;
  white-space: nowrap;
  margin-right: 8px;
  flex-shrink: 0;
  padding-left: 5px;
  line-height: 1.5;
}

.notice-content-container {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  line-height: 1.5;
}

.notice-content {
  font-size: 13px;
  color: #ff7b35;
  white-space: nowrap;
  animation: marquee 10s linear infinite;
  display: inline-block;
  line-height: 1.5;
}

@keyframes marquee {
  0% {
    transform: translateX(100%);
  }
  100% {
    transform: translateX(-100%);
  }
}

/* 基金列表 */
.fund-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 5px;
  min-height: 0;
}

/* 滚动条样式 */
.fund-list::-webkit-scrollbar {
  width: 6px;
}

.fund-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.fund-list::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.fund-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* 基金卡片 */
.fund-card {
  padding: 15px;
  transform: none !important;
}

.fund-card:active {
  transform: none !important;
}

.fund-card * {
  transform: none !important;
}

.fund-card *:active {
  transform: none !important;
}

/* 简化基金布局 */
.fund-simple {
  display: flex;
  align-items: center;
  gap: 15px;
}

.fund-name {
  flex: 1;
  min-width: 0;
}

.fund-name h3 {
  margin: 0 0 5px 0;
  font-size: 16px;
  overflow: hidden;
}

.fund-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.fund-name p {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.fund-estimate {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.fund-estimate .value {
  font-size: 16px;
  font-weight: bold;
}

.fund-estimate .value.positive {
  color: #F56C6C;
}

.fund-estimate .value.negative {
  color: #67C23A;
}

.fund-estimate .value.zero {
  color: #909399;
}

.fund-estimate .estimate-value {
  font-size: 14px;
  color: #666;
  margin-top: 2px;
}

.fund-actions {
  display: flex;
  align-items: center;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
  transition: color 0.3s;
  padding: 0 5px;
}

.remove-btn:hover {
  color: #ef4444;
}

/* 空状态 */
.empty-state {
  padding: 40px;
  text-align: center;
  color: #666;
}

/* 加载动画 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 4px solid #60a5fa;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-tips {
  color: white;
  font-size: 16px;
  text-align: center;
  margin-top: 10px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .container {
    padding: 15px;
  }
  
  .fund-form {
    padding: 15px;
  }
  
  .fund-list {
    gap: 12px;
  }
  
  .fund-item {
    padding: 15px;
  }
  
  .stocks-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .loading-spinner {
    width: 50px;
    height: 50px;
  }
  
  .loading-tips {
    font-size: 14px;
  }
}
</style>
