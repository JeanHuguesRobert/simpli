echo Update simpli wiki pages
cd ~
cd SimpliWiki
cd simpli
cd simplijs
cd wiki
pwd
for file in *; do
  f=$(basename $file);
  other_f="../../../virteal/wiki/$f";
  if [ "$f" -ot "$other_f" ]; then
    echo Updating $f
    cp -f "$other_f" "$f"
    git add "$f"
  fi
done

cd ..
echo "Done, ready to git commit & git push"

