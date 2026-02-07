# 构建时把每篇文章的同级图片文件夹复制到 _site/<url>/<asset-dir>，Typora 与 HTML 共用同一套图
require 'fileutils'

Jekyll::Hooks.register :site, :post_write do |site|
  next unless site.collections.key?('articles')
  coll = site.collections['articles']
  base = File.join(site.source, coll.relative_directory)
  coll.docs.each do |doc|
    asset_dir = doc.data['asset-dir'] || doc.data['asset_dir']
    next if asset_dir.nil? || asset_dir.to_s.empty?
    asset_dir = asset_dir.to_s

    src_dir = File.join(base, asset_dir)
    next unless File.directory?(src_dir)

    out_path = doc.url.sub(%r{^/}, '').sub(%r{/$}, '')
    dest_dir = File.join(site.dest, out_path, asset_dir)
    FileUtils.mkdir_p(File.dirname(dest_dir))
    FileUtils.cp_r(src_dir, dest_dir, remove_destination: true)
  end
end
