# 构建时把每篇文章的同级图片文件夹复制到输出目录，Typora 与 HTML 共用同一套图，无需 sync
Jekyll::Hooks.register [:articles], :post_write do |doc|
  asset_dir = doc.data['asset-dir'] || doc.data['asset_dir']
  next if asset_dir.nil? || asset_dir.to_s.empty?

  site = doc.site
  src_dir = File.join(site.source, File.dirname(doc.relative_path), asset_dir.to_s)
  out_path = doc.url.sub(%r{^/}, '').sub(%r{/$}, '')
  dest_dir = File.join(site.dest, out_path, asset_dir.to_s)

  next unless File.directory?(src_dir)

  require 'fileutils'
  FileUtils.mkdir_p(File.dirname(dest_dir))
  FileUtils.cp_r(src_dir, dest_dir, remove_destination: true)
end
