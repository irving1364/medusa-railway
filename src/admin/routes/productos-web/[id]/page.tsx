import { useParams } from "react-router-dom"
import WebProductEditor from "../../../components/web-product-editor"

/** /productos-web/:id — edit an existing product with the four-block form. */
const EditWebProductPage = () => {
  const { id } = useParams()
  return <WebProductEditor productId={id} />
}

export default EditWebProductPage
