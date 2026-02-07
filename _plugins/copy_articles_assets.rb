# frozen_string_literal: true
# 把每篇文章的 *.assets 复制到 _site 里该文章的目录下，这样相对路径 ./xxx.assets/ 才能正确显示图片。
# 图片只在 _articles 下保留一份。Jekyll 的 collection URL 会变成小写（如 hicplot），所以用 doc.url 得到真实路径。
module Jekyll
  class CopyArticlesAssetsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      articles = site.collections["articles"]
      return unless articles

      src_root = File.join(site.source, "_articles")
      return unless File.directory?(src_root)

      articles.docs.each do |doc|
        # 文章输出目录（Jekyll 会写成小写，如 _site/_articles/hicplot/）
        doc_path = doc.url.gsub(%r{^/}, "").sub(%r{/$}, "")
        doc_dest = File.join(site.dest, doc_path)
        # generate 阶段 Jekyll 还没写入文件，目录不存在，需要先创建
        FileUtils.mkdir_p(doc_dest)

        folder = doc.data["assets_folder"] || "#{doc.basename}.assets"
        src_dir = File.join(src_root, folder)
        next unless File.directory?(src_dir)

        dest_assets = File.join(doc_dest, folder)
        FileUtils.cp_r(src_dir, dest_assets, remove_destination: true)
      end
    end
  end
end
