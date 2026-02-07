# frozen_string_literal: true
# Jekyll Generator: copy _articles static files (e.g. *.assets/) to _site/_articles/
# so that relative image paths in article content resolve without moving images in the repo.
module Jekyll
  class CopyArticlesAssetsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      src = File.join(site.source, "_articles")
      dest = File.join(site.dest, "_articles")
      return unless File.directory?(src)

      FileUtils.mkdir_p(dest)
      Dir.each_child(src) do |name|
        next if name.end_with?(".md")
        src_path = File.join(src, name)
        dest_path = File.join(dest, name)
        if File.directory?(src_path)
          FileUtils.cp_r(src_path, dest_path, remove_destination: true)
        else
          FileUtils.cp(src_path, dest_path, preserve: true)
        end
      end
    end
  end
end
