let path = require('path')
let fs = require('fs')
let rp = require('request-promise')
let originUrl = 'https://www.zhihu.com'

class Crawler {
  constructor (options) {
    const { dir = './imgs', proxyUrl = originUrl, questionId = '49364343', offset = 0, limit = 100, timeout = 10000 } = options

    this.originUrl = originUrl
    this.proxyUrl = proxyUrl
    this.uri = `${proxyUrl}/api/v4/questions/${questionId}/answers?limit=${limit}&offset=${offset}&include=data%5B%2A%5D.is_normal%2Cadmin_closed_comment%2Creward_info%2Cis_collapsed%2Cannotation_action%2Cannotation_detail%2Ccollapse_reason%2Cis_sticky%2Ccollapsed_by%2Csuggest_edit%2Ccomment_count%2Ccan_comment%2Ccontent%2Ceditable_content%2Cvoteup_count%2Creshipment_settings%2Ccomment_permission%2Ccreated_time%2Cupdated_time%2Creview_info%2Crelevant_info%2Cquestion%2Cexcerpt%2Crelationship.is_authorized%2Cis_author%2Cvoting%2Cis_thanked%2Cis_nothelp%3Bdata%5B%2A%5D.mark_infos%5B%2A%5D.url%3Bdata%5B%2A%5D.author.follower_count%2Cbadge%5B%3F%28type%3Dbest_answerer%29%5D.topics&sort_by=default`
    this.isEnd = false
    this.questionId = questionId
    this.timeout = timeout
    this.imgs = []
    this.dir = dir
    this.folderPath = ''
    this.downloaded = 0

    this.init()
  }

  async init () {
    if (this.isEnd) {
      console.log('已经全部下载完成, 请欣赏')
      return
    }

    let { isEnd, uri, imgs, question } = await this.getAnswers()

    this.isEnd = isEnd
    this.uri = uri
    this.imgs = imgs
    this.downloaded = 0
    this.question = question
    console.log(imgs, imgs.length)
    this.createFolder()
    this.downloadAllImg(() => {
      if (this.downloaded >= this.imgs.length) {
        setTimeout(() => {
          console.log('休息3秒钟继续下一波')
          this.init()
        }, 3000)
      }
    })
  }

  async getAnswers () {
    let { uri, timeout } = this
    let response = {}

    try {
      const { paging, data } = await rp({ uri, json: true, timeout })
      const { is_end: isEnd, next } = paging
      const { question } = Object(data[0])
      const content = data.reduce((content, it) => content + it.content, '')
      const imgs = this.matchImg(content)

      response = { isEnd, uri: next.replace(originUrl, this.proxyUrl), imgs, question }
    } catch (error) {
      console.log('调用知乎api出错,请重试')
      console.log(error)
    }

    return response
  }

  matchImg (content) {
    let imgs = []
    let matchImgOriginRe = /<img.*?data-original="(.*?)"/g

    content.replace(matchImgOriginRe, ($0, $1) => imgs.push($1))

    return [ ...new Set(imgs) ]
  }

  createFolder () {
    let { dir, questionId } = this
    let folderPath = `${dir}/${questionId}`
    let dirs = [ dir, folderPath ]

    dirs.forEach((dir) => !fs.existsSync(dir) && fs.mkdirSync(dir))

    this.folderPath = folderPath
  }

  downloadAllImg (cb) {
    let { folderPath, timeout } = this
    this.imgs.forEach((imgUrl) => {
      let fileName = path.basename(imgUrl)
      let filePath = `${folderPath}/${fileName}`

      rp({ uri: imgUrl, timeout })
        .on('error', () => {
          console.log(`${imgUrl} 下载出错`)
          this.downloaded += 1
          cb()
        })
        .pipe(fs.createWriteStream(filePath))
        .on('close', () => {
          this.downloaded += 1
          console.log(`${imgUrl} 下载完成`)
          cb()
        })
    })
  }
}

module.exports = (payload = {}) => {
  return new Crawler(payload)
}
