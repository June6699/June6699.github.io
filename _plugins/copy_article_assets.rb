# 构建时把每篇文章的同级图片文件夹复制到 _site/<url>/<asset-dir>，Typora 与 HTML 共用同一套图
require 'fileutils'

Jekyll::Hooks.register :site, :post_write do |site|
  next unless site.collections.key?('articles')
  site.collections['articles'].docs.each do |doc|
    asset_dir = doc.data['asset-dir'] || doc.data['asset_dir']
    next if asset_dir.nil? || asset_dir.to_s.empty?

    src_dir = File.join(File.dirname(doc.path), asset_dir.to_s)
    next unless File.directory?(src_dir)

    out_path = doc.url.sub(%r{^/}, '').sub(%r{/$}, '')
    dest_dir = File.join(site.dest, out_path, asset_dir.to_s)
    FileUtils.mkdir_p(File.dirname(dest_dir))
    FileUtils.cp_r(src_dir, dest_dir, remove_destination: true)
  end
end
