# frozen_string_literal: true
# 把每篇文章的 *.assets 复制到 _site 里该文章的目录下，这样相对路径 ./xxx.assets/ 才能正确显示图片。
# 图片只在 _articles 下保留一份，不移动、不复制到仓库其他位置。
module Jekyll
  class CopyArticlesAssetsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      articles = site.collections["articles"]
      return unless articles

      src_root = File.join(site.source, "_articles")
      dest_root = File.join(site.dest, "_articles")
      return unless File.directory?(src_root)

      articles.docs.each do |doc|
        # 文章输出目录，如 _site/_articles/HiCPlot/
        doc_path = doc.url.gsub(%r{^/}, "").sub(%r{/$}, "")
        doc_dest = File.join(site.dest, doc_path)
        next unless File.directory?(doc_dest)

        # 资源目录名：front matter 里 assets_folder 或默认 文件名.assets
        folder = doc.data["assets_folder"] || "#{doc.basename}.assets"
        src_dir = File.join(src_root, folder)
        next unless File.directory?(src_dir)

        dest_assets = File.join(doc_dest, folder)
        FileUtils.mkdir_p(File.dirname(dest_assets))
        FileUtils.cp_r(src_dir, dest_assets, remove_destination: true)
      end
    end
  end
end
