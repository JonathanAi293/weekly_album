import Link from "next/link";
import { AlbumCover } from "@/components/AlbumCover";
import { RecordShelfMotion } from "@/components/RecordShelfMotion";
import type { Issue } from "@/lib/models";
import styles from "./WeeklyRecordShelf.module.css";

export function WeeklyRecordShelf({ issue }: { issue: Issue }) {
  const issueHref = `/issues/${issue.slug}`;
  const issueNumber = issue.number.replace(/^#0+(?=\d)/, "#");
  const issueDate = issue.date.split(" · ")[0].replace(/\b0(\d)\b/g, "$1");

  return <section className={styles.shelf} aria-labelledby="weekly-shelf-title">
    <div className={styles.inner}>
      <header className={styles.heading}>
        <h2 id="weekly-shelf-title">{issueNumber}</h2>
        <span>{issueDate}</span>
      </header>

      {issue.albums.length === 0 ? <p className={styles.empty}>这一期的唱片还在准备中。</p> :
        <RecordShelfMotion className={styles.records}>
          {issue.albums.map((album, index) => <article className={styles.record} data-shelf-record data-shelf-album={album.id} key={album.id}>
            <Link className={styles.recordLink} href={`${issueHref}#${album.id}`} data-album-transition aria-label={`查看 ${album.artist} 的专辑 ${album.title}`}>
              <div className={styles.object} data-shelf-object aria-hidden="true">
                <div className={styles.sleeve} data-shelf-face>
                  <AlbumCover className={styles.cover} cover={album.cover} title={album.title} />
                  <span className={styles.sheen} />
                </div>
                <div className={styles.spine} data-shelf-spine><span>{album.artist}</span><span>{album.title}</span><span>FR / {String(index + 1).padStart(2, "0")}</span></div>
              </div>
            </Link>
          </article>)}
        </RecordShelfMotion>}
    </div>
  </section>;
}
