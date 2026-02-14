module.exports = {
  publicPath: process.env.NODE_ENV === 'production' ? '/daben-yangji/' : './',
  outputDir: 'docs',
  assetsDir: 'static',
  lintOnSave: process.env.NODE_ENV === 'development',
  productionSourceMap: false,
  devServer: {
    host: 'localhost',
    port: 8080,
    open: true,
    overlay: {
      warnings: false,
      errors: true
    },
    proxy: {
      '/api': {
        target: 'https://api.fund.eastmoney.com',
        changeOrigin: true,
        pathRewrite: {
          '^/api': ''
        },
        headers: {
          'Referer': 'http://fundf10.eastmoney.com/',
          'Origin': 'http://fundf10.eastmoney.com'
        }
      }
    }
  }
}